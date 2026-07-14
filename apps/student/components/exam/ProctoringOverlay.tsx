"use client"
import { memo, useEffect, useState } from "react"
import { ShieldAlert, ShieldCheck, AlertTriangle, X, Maximize2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Violation, ViolationType } from "@/hooks/useProctoring"

// ─── Violation Toast ───────────────────────────────────────────────────────────
export const ViolationToast = memo(function ViolationToast({
  violation,
  onDismiss,
}: {
  violation: Violation
  onDismiss: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, violation.severity === "critical" ? 6000 : 3500)
    return () => clearTimeout(t)
  }, [violation.id, violation.severity, onDismiss])

  return (
    <div className={cn(
      "flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg text-sm max-w-sm w-full",
      "animate-in slide-in-from-top-2 duration-200",
      violation.severity === "critical"
        ? "bg-[color:var(--color-danger-50)] border-[color:var(--color-danger-500)] text-[color:var(--color-danger-700)]"
        : "bg-[color:var(--color-warning-50)] border-[color:var(--color-warning-500)] text-[color:var(--color-warning-700)]"
    )}>
      <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-xs uppercase tracking-wide mb-0.5">
          {violation.severity === "critical" ? "⚠ Violation Recorded" : "Warning"}
        </p>
        <p className="leading-snug">{violation.message}</p>
      </div>
      <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
})

// ─── Fullscreen Return Modal ───────────────────────────────────────────────────
export const FullscreenWarningModal = memo(function FullscreenWarningModal({
  onReenter,
  countdown,
}: {
  onReenter: () => void
  countdown: number
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center space-y-5">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-danger-50)] border-2 border-[color:var(--color-danger-500)]">
            <ShieldAlert className="h-8 w-8 text-[color:var(--color-danger-500)]" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#1e293b]">Fullscreen Required</h2>
          <p className="text-sm text-[#64748b] mt-2">
            You exited fullscreen mode. This violation has been recorded.
            Return to fullscreen immediately.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-[color:var(--color-danger-500)] font-mono text-3xl font-bold">
          {countdown}
        </div>
        <p className="text-xs text-[#94a3b8]">Auto-submits if you don&apos;t return</p>
        <button
          onClick={onReenter}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] text-white font-semibold py-3 hover:opacity-90 transition-opacity"
        >
          <Maximize2 className="h-4 w-4" />
          Return to Fullscreen
        </button>
      </div>
    </div>
  )
})

// ─── Termination Screen ────────────────────────────────────────────────────────
export const TerminationScreen = memo(function TerminationScreen({
  violationCount,
}: { violationCount: number }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0f172a]">
      <div className="text-center space-y-5 max-w-md mx-4">
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--color-danger-500)]/20 border-2 border-[color:var(--color-danger-500)]">
            <ShieldAlert className="h-10 w-10 text-[color:var(--color-danger-500)]" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white">Exam Terminated</h1>
        <p className="text-[#94a3b8] leading-relaxed">
          Your exam has been auto-submitted due to{" "}
          <span className="text-[color:var(--color-danger-400)] font-semibold">
            {violationCount} critical violation{violationCount !== 1 ? "s" : ""}
          </span>
          . Your answers up to this point have been saved.
        </p>
        <p className="text-xs text-[#475569]">Submitting results and redirecting…</p>
        <div className="h-1 w-48 mx-auto rounded-full bg-[#1e293b] overflow-hidden">
          <div className="h-full w-full rounded-full bg-[color:var(--color-danger-500)] animate-pulse" />
        </div>
      </div>
    </div>
  )
})

// ─── Proctoring Status Badge (header indicator) ───────────────────────────────
export const ProctoringBadge = memo(function ProctoringBadge({
  violationCount,
  criticalCount,
}: {
  violationCount: number
  criticalCount: number
}) {
  if (violationCount === 0) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 text-xs text-[color:var(--color-success-700)] bg-[color:var(--color-success-50)] border border-[color:var(--color-success-500)]/30 rounded-full px-2.5 py-1">
        <ShieldCheck className="h-3 w-3" />
        Proctored
      </div>
    )
  }
  return (
    <div className={cn(
      "hidden sm:flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border",
      criticalCount > 0
        ? "text-[color:var(--color-danger-700)] bg-[color:var(--color-danger-50)] border-[color:var(--color-danger-500)]/30"
        : "text-[color:var(--color-warning-700)] bg-[color:var(--color-warning-50)] border-[color:var(--color-warning-500)]/30"
    )}>
      <AlertTriangle className="h-3 w-3" />
      {criticalCount > 0 ? `${criticalCount} violation${criticalCount > 1 ? "s" : ""}` : `${violationCount} warning${violationCount > 1 ? "s" : ""}`}
    </div>
  )
})

// ─── Violation type label helper ───────────────────────────────────────────────
export function violationLabel(type: ViolationType): string {
  const labels: Record<ViolationType, string> = {
    tab_switch: "Tab Switch",
    window_blur: "Window Blur",
    fullscreen_exit: "Fullscreen Exit",
    devtools_open: "DevTools Open",
    copy_attempt: "Copy Attempt",
    paste_attempt: "Paste Attempt",
    keyboard_shortcut: "Blocked Shortcut",
    no_face_detected: "No Face",
    multiple_faces: "Multiple Faces",
    gaze_away: "Gaze Away",
    webcam_denied: "Webcam Denied",
  }
  return labels[type] ?? type
}
