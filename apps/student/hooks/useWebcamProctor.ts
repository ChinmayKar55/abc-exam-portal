"use client"
import { useCallback, useEffect, useRef, useState } from "react"

export interface WebcamProctoringState {
  stream: MediaStream | null
  permitted: boolean
  denied: boolean
  isReady: boolean
  faceStatus: "ok" | "no_face" | "multiple_faces" | "gaze_away" | "loading"
}

interface UseWebcamProctoringOptions {
  enabled: boolean
  onNoFace?: () => void
  onMultipleFaces?: () => void
  onGazeAway?: () => void
}

// face-api.js is loaded dynamically to avoid SSR issues and keep bundle lean
let faceApiLoaded = false
let faceApiLoading = false
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let faceApi: any = null

async function loadFaceApi() {
  if (faceApiLoaded) return faceApi
  if (faceApiLoading) {
    // Wait for it
    await new Promise<void>((res) => {
      const iv = setInterval(() => { if (faceApiLoaded) { clearInterval(iv); res() } }, 100)
    })
    return faceApi
  }
  faceApiLoading = true
  try {
    // Dynamic import — only loaded when webcam proctoring is needed
    const api = await import("@vladmandic/face-api")
    faceApi = api
    // Load lightweight models from CDN-hosted paths
    const MODEL_URL = "/face-api-models"
    await Promise.all([
      api.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      api.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    ])
    faceApiLoaded = true
  } catch {
    faceApiLoaded = false
  } finally {
    faceApiLoading = false
  }
  return faceApi
}

const NO_FACE_GRACE_MS = 4000  // must be missing for 4s before firing
const GAZE_AWAY_THRESHOLD = 0.3 // fraction of face width as horizontal gaze offset

export function useWebcamProctor({
  enabled,
  onNoFace,
  onMultipleFaces,
  onGazeAway,
}: UseWebcamProctoringOptions): WebcamProctoringState {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [permitted, setPermitted] = useState(false)
  const [denied, setDenied] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [faceStatus, setFaceStatus] = useState<WebcamProctoringState["faceStatus"]>("loading")

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const noFaceStartRef = useRef<number | null>(null)
  const gazeAwayStartRef = useRef<number | null>(null)

  // Create hidden video element for analysis
  useEffect(() => {
    if (!enabled) return
    const video = document.createElement("video")
    video.setAttribute("autoplay", "")
    video.setAttribute("muted", "")
    video.setAttribute("playsinline", "")
    video.style.position = "fixed"
    video.style.opacity = "0"
    video.style.pointerEvents = "none"
    video.style.width = "1px"
    video.style.height = "1px"
    video.style.top = "-9999px"
    document.body.appendChild(video)
    videoRef.current = video
    return () => {
      video.remove()
      videoRef.current = null
    }
  }, [enabled])

  // Request camera permission
  useEffect(() => {
    if (!enabled) return
    navigator.mediaDevices
      .getUserMedia({ video: { width: 320, height: 240, facingMode: "user" } })
      .then((s) => {
        setStream(s)
        setPermitted(true)
        if (videoRef.current) {
          videoRef.current.srcObject = s
          videoRef.current.play().catch(() => {})
        }
      })
      .catch(() => {
        setDenied(true)
      })
  }, [enabled])

  // Load face-api and start analysis loop
  useEffect(() => {
    if (!enabled || !permitted || !stream) return

    let active = true

    const start = async () => {
      const api = await loadFaceApi()
      if (!api || !active) return
      setIsReady(true)
      setFaceStatus("loading")

      // Wait for video to be ready
      await new Promise<void>((res) => {
        const check = () => {
          if (videoRef.current && videoRef.current.readyState >= 2) res()
          else setTimeout(check, 200)
        }
        check()
      })
      if (!active) return

      intervalRef.current = setInterval(async () => {
        if (!active || !videoRef.current) return
        try {
          const detections = await api.detectAllFaces(
            videoRef.current,
            new api.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.4 })
          ).withFaceLandmarks(true)

          const count = detections.length
          const now = Date.now()

          if (count === 0) {
            setFaceStatus("no_face")
            if (noFaceStartRef.current === null) noFaceStartRef.current = now
            else if (now - noFaceStartRef.current > NO_FACE_GRACE_MS) {
              noFaceStartRef.current = null
              onNoFace?.()
            }
            gazeAwayStartRef.current = null
          } else if (count > 1) {
            setFaceStatus("multiple_faces")
            noFaceStartRef.current = null
            onMultipleFaces?.()
          } else {
            noFaceStartRef.current = null
            // Gaze estimation via nose/eye landmarks
            const lms = detections[0].landmarks
            const nose = lms.getNose()[3] // tip of nose
            const box = detections[0].detection.box
            const faceCenter = box.x + box.width / 2
            const gazeOffset = Math.abs(nose.x - faceCenter) / box.width

            if (gazeOffset > GAZE_AWAY_THRESHOLD) {
              setFaceStatus("gaze_away")
              if (gazeAwayStartRef.current === null) gazeAwayStartRef.current = now
              else if (now - gazeAwayStartRef.current > 3000) {
                gazeAwayStartRef.current = null
                onGazeAway?.()
              }
            } else {
              gazeAwayStartRef.current = null
              setFaceStatus("ok")
            }
          }
        } catch {
          // analysis frame error — skip
        }
      }, 1500) // analyse every 1.5s
    }

    start()

    return () => {
      active = false
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [enabled, permitted, stream, onNoFace, onMultipleFaces, onGazeAway])

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop())
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [stream])

  return { stream, permitted, denied, isReady, faceStatus }
}
