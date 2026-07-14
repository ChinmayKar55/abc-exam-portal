"use client"
import { useCallback, useEffect, useRef, useState } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────
export type ViolationType =
  | "tab_switch"
  | "window_blur"
  | "fullscreen_exit"
  | "devtools_open"
  | "copy_attempt"
  | "paste_attempt"
  | "keyboard_shortcut"
  | "no_face_detected"
  | "multiple_faces"
  | "gaze_away"
  | "webcam_denied"

export type ViolationSeverity = "warn" | "critical"

export interface Violation {
  id: string
  type: ViolationType
  severity: ViolationSeverity
  message: string
  timestamp: number
}

export interface ProctoringState {
  violations: Violation[]
  violationCount: number
  criticalCount: number
  isFullscreen: boolean
  isTerminated: boolean
  latestViolation: Violation | null
}

interface UseProctoringOptions {
  attemptId: string
  enabled: boolean
  autoTerminateAt?: number          // critical violations before force-submit (default 3)
  onReport: (type: ViolationType, severity: ViolationSeverity, meta?: Record<string, unknown>) => void
  onTerminate: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const VIOLATION_MESSAGES: Record<ViolationType, string> = {
  tab_switch:        "You switched tabs. This has been recorded.",
  window_blur:       "You left the exam window. This has been recorded.",
  fullscreen_exit:   "You exited fullscreen mode. Return immediately.",
  devtools_open:     "Developer tools detected. This has been recorded.",
  copy_attempt:      "Copying exam content is not allowed.",
  paste_attempt:     "Pasting is not allowed during the exam.",
  keyboard_shortcut: "That keyboard shortcut is blocked during the exam.",
  no_face_detected:  "No face detected. Please stay in frame.",
  multiple_faces:    "Multiple faces detected. Only you should be present.",
  gaze_away:         "Please keep your eyes on the screen.",
  webcam_denied:     "Webcam access was denied. Your exam is flagged.",
}

const VIOLATION_SEVERITY: Record<ViolationType, ViolationSeverity> = {
  tab_switch:        "critical",
  window_blur:       "warn",
  fullscreen_exit:   "critical",
  devtools_open:     "critical",
  copy_attempt:      "warn",
  paste_attempt:     "warn",
  keyboard_shortcut: "warn",
  no_face_detected:  "critical",
  multiple_faces:    "critical",
  gaze_away:         "warn",
  webcam_denied:     "warn",
}

let _violationIdCounter = 0
function makeViolation(type: ViolationType): Violation {
  return {
    id: `v-${++_violationIdCounter}`,
    type,
    severity: VIOLATION_SEVERITY[type],
    message: VIOLATION_MESSAGES[type],
    timestamp: Date.now(),
  }
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useProctoring({
  enabled,
  autoTerminateAt = 3,
  onReport,
  onTerminate,
}: UseProctoringOptions): ProctoringState {
  const [violations, setViolations] = useState<Violation[]>([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isTerminated, setIsTerminated] = useState(false)
  const criticalRef = useRef(0)
  const terminatedRef = useRef(false)
  const devToolsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const report = useCallback((type: ViolationType, meta?: Record<string, unknown>) => {
    if (!enabled || terminatedRef.current) return
    const v = makeViolation(type)
    setViolations((prev) => [v, ...prev].slice(0, 50)) // keep last 50

    if (v.severity === "critical") {
      criticalRef.current += 1
      if (criticalRef.current >= autoTerminateAt) {
        terminatedRef.current = true
        setIsTerminated(true)
        onTerminate()
      }
    }
    onReport(type, v.severity, meta)
  }, [enabled, autoTerminateAt, onReport, onTerminate])

  // ── Fullscreen enforcement ─────────────────────────────────────────────────
  const enterFullscreen = useCallback(() => {
    if (document.fullscreenElement) return
    document.documentElement.requestFullscreen().catch(() => {})
  }, [])

  useEffect(() => {
    if (!enabled) return
    // Request fullscreen on mount
    enterFullscreen()

    const handleFSChange = () => {
      const isFS = !!document.fullscreenElement
      setIsFullscreen(isFS)
      if (!isFS && !terminatedRef.current) {
        report("fullscreen_exit")
      }
    }
    document.addEventListener("fullscreenchange", handleFSChange)
    return () => document.removeEventListener("fullscreenchange", handleFSChange)
  }, [enabled, enterFullscreen, report])

  // ── Tab/window focus ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        report("tab_switch")
      }
    }
    const handleBlur = () => report("window_blur")

    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("blur", handleBlur)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("blur", handleBlur)
    }
  }, [enabled, report])

  // ── Copy / Paste / Cut ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return

    const block = (e: ClipboardEvent) => {
      e.preventDefault()
      report(e.type === "paste" ? "paste_attempt" : "copy_attempt")
    }
    const blockCut = (e: ClipboardEvent) => { e.preventDefault(); report("copy_attempt") }

    document.addEventListener("copy", block)
    document.addEventListener("paste", block)
    document.addEventListener("cut", blockCut)
    return () => {
      document.removeEventListener("copy", block)
      document.removeEventListener("paste", block)
      document.removeEventListener("cut", blockCut)
    }
  }, [enabled, report])

  // ── Right-click ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return
    const block = (e: MouseEvent) => e.preventDefault()
    document.addEventListener("contextmenu", block)
    return () => document.removeEventListener("contextmenu", block)
  }, [enabled])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return

    const BLOCKED: Array<(e: KeyboardEvent) => boolean> = [
      (e) => e.key === "F12",
      (e) => e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase()),
      (e) => e.ctrlKey && e.key.toLowerCase() === "u",
      (e) => e.ctrlKey && e.key.toLowerCase() === "s",
      (e) => e.altKey && e.key === "Tab",
      (e) => e.metaKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase()),
    ]

    const handler = (e: KeyboardEvent) => {
      if (BLOCKED.some((check) => check(e))) {
        e.preventDefault()
        report("keyboard_shortcut", { key: e.key })
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [enabled, report])

  // ── DevTools detection ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return

    let reported = false
    const check = () => {
      const threshold = 160
      const widthDiff = window.outerWidth - window.innerWidth > threshold
      const heightDiff = window.outerHeight - window.innerHeight > threshold
      if ((widthDiff || heightDiff) && !reported) {
        reported = true
        report("devtools_open")
      }
      if (!widthDiff && !heightDiff) {
        reported = false // reset so repeated opens keep triggering
      }
    }

    devToolsIntervalRef.current = setInterval(check, 2000)
    return () => {
      if (devToolsIntervalRef.current) clearInterval(devToolsIntervalRef.current)
    }
  }, [enabled, report])

  const criticalCount = violations.filter((v) => v.severity === "critical").length

  return {
    violations,
    violationCount: violations.length,
    criticalCount,
    isFullscreen,
    isTerminated,
    latestViolation: violations[0] ?? null,
  }
}
