"use client"
import { memo, useEffect, useRef } from "react"
import { Camera, CameraOff, Eye, EyeOff, Users, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WebcamProctoringState } from "@/hooks/useWebcamProctor"

interface WebcamPiPProps {
  webcam: WebcamProctoringState
}

const FACE_STATUS_CONFIG = {
  ok:              { icon: Eye,           color: "text-[color:var(--color-success-500)]", label: "Face detected" },
  no_face:         { icon: EyeOff,        color: "text-[color:var(--color-danger-500)]",  label: "No face!" },
  multiple_faces:  { icon: Users,         color: "text-[color:var(--color-danger-500)]",  label: "Multiple faces!" },
  gaze_away:       { icon: AlertTriangle, color: "text-[color:var(--color-warning-500)]", label: "Look at screen" },
  loading:         { icon: Camera,        color: "text-[#94a3b8]",                        label: "Initialising…" },
}

export const WebcamPiP = memo(function WebcamPiP({ webcam }: WebcamPiPProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (webcam.stream && videoRef.current) {
      videoRef.current.srcObject = webcam.stream
      videoRef.current.play().catch(() => {})
    }
  }, [webcam.stream])

  if (webcam.denied) {
    return (
      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-xl bg-[color:var(--color-danger-50)] border border-[color:var(--color-danger-500)]/30 px-3 py-2 text-xs text-[color:var(--color-danger-700)] shadow-lg">
        <CameraOff className="h-3.5 w-3.5 shrink-0" />
        Camera denied — exam flagged
      </div>
    )
  }

  if (!webcam.permitted) return null

  const statusCfg = FACE_STATUS_CONFIG[webcam.faceStatus]
  const StatusIcon = statusCfg.icon
  const isAlert = webcam.faceStatus === "no_face" || webcam.faceStatus === "multiple_faces"

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-40 rounded-2xl overflow-hidden shadow-2xl border-2 transition-all duration-300",
      isAlert
        ? "border-[color:var(--color-danger-500)] ring-2 ring-[color:var(--color-danger-500)]/30 animate-pulse"
        : webcam.faceStatus === "gaze_away"
        ? "border-[color:var(--color-warning-500)]"
        : "border-[#1e293b]/40"
    )}>
      {/* Camera feed */}
      <div className="relative w-36 h-28 bg-[#0f172a]">
        <video
          ref={videoRef}
          muted
          playsInline
          className="w-full h-full object-cover scale-x-[-1]" // mirror for selfie view
        />

        {/* Status overlay bar */}
        <div className={cn(
          "absolute bottom-0 inset-x-0 flex items-center gap-1.5 px-2 py-1",
          isAlert ? "bg-[color:var(--color-danger-500)]" :
          webcam.faceStatus === "gaze_away" ? "bg-[color:var(--color-warning-500)]" :
          "bg-black/60"
        )}>
          <StatusIcon className={cn("h-3 w-3 shrink-0 text-white")} />
          <span className="text-[10px] font-medium text-white truncate">{statusCfg.label}</span>
        </div>

        {/* Corner badge */}
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5">
          <div className={cn(
            "h-1.5 w-1.5 rounded-full",
            isAlert ? "bg-[color:var(--color-danger-400)] animate-pulse" : "bg-[color:var(--color-success-400)]"
          )} />
          <span className="text-[9px] font-bold text-white tracking-wide">LIVE</span>
        </div>
      </div>
    </div>
  )
})

// ─── Pre-exam Webcam Permission Modal ─────────────────────────────────────────
interface WebcamPermissionModalProps {
  onAllow: () => void
  onDeny: () => void
}

export const WebcamPermissionModal = memo(function WebcamPermissionModal({
  onAllow,
  onDeny,
}: WebcamPermissionModalProps) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-brand-50)] border-2 border-[color:var(--color-brand-200)]">
              <Camera className="h-8 w-8 text-[var(--primary)]" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-[#1e293b]">Webcam Proctoring</h2>
          <p className="text-sm text-[#475569] leading-relaxed">
            This exam uses webcam-based proctoring. Your camera feed is used
            to verify your presence. No video is recorded or stored — only
            periodic snapshots for audit purposes.
          </p>
        </div>

        <ul className="space-y-2 text-sm text-[#334155]">
          {[
            "Ensure you are in a well-lit area",
            "Your face must be clearly visible at all times",
            "Only you should be in the camera frame",
            "Denial will flag your attempt for manual review",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-[color:var(--color-brand-100)] flex items-center justify-center">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
              </span>
              {item}
            </li>
          ))}
        </ul>

        <div className="flex gap-3">
          <button
            onClick={onDeny}
            className="flex-1 rounded-xl border-2 border-[var(--border)] text-[var(--muted-foreground)] font-medium py-3 text-sm hover:bg-[var(--secondary)] transition-colors"
          >
            Deny (flag attempt)
          </button>
          <button
            onClick={onAllow}
            className="flex-1 rounded-xl bg-[var(--primary)] text-white font-semibold py-3 text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Camera className="h-4 w-4" />
            Allow Camera
          </button>
        </div>
      </div>
    </div>
  )
})
