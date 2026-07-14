"use client"
import {
  memo, useCallback, useReducer, useRef, useState, useEffect,
} from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle, Send, FileText, ClipboardList, CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useCountdown } from "@/hooks/useCountdown"
import { useExamWS } from "@/hooks/useExamWS"
import { useProctoring } from "@/hooks/useProctoring"
import { useWebcamProctor } from "@/hooks/useWebcamProctor"
import { examQueries } from "@/lib/queries/exams"
import { formatCountdown, cn } from "@/lib/utils"
import type { StartResponse, ShuffledQuestion } from "@/lib/queries/exams"
import {
  ViolationToast, FullscreenWarningModal, TerminationScreen, ProctoringBadge,
} from "@/components/exam/ProctoringOverlay"
import { WebcamPiP, WebcamPermissionModal } from "@/components/exam/WebcamPiP"

// ─── State ───────────────────────────────────────────────────────────────────
interface OMRState {
  answers: Record<string, string>
  submitted: boolean
}
type OMRAction =
  | { type: "SET_ANSWER"; questionId: string; answer: string }
  | { type: "SUBMIT" }

function omrReducer(state: OMRState, action: OMRAction): OMRState {
  switch (action.type) {
    case "SET_ANSWER":
      return { ...state, answers: { ...state.answers, [action.questionId]: action.answer } }
    case "SUBMIT":
      return { ...state, submitted: true }
    default:
      return state
  }
}

// ─── Timer ───────────────────────────────────────────────────────────────────
const OMRTimer = memo(function OMRTimer({
  expiresAt, onExpire,
}: { expiresAt: string; onExpire: () => void }) {
  const secs = useCountdown(expiresAt, onExpire)
  const critical = secs < 60
  const warning = secs < 300
  return (
    <div className={cn(
      "flex items-center gap-1.5 font-mono text-sm font-bold px-3 py-1 rounded-full border",
      critical
        ? "bg-[color:var(--color-danger-50)] border-[color:var(--color-danger-500)] text-[color:var(--color-danger-700)] animate-pulse"
        : warning
        ? "bg-[color:var(--color-warning-50)] border-[color:var(--color-warning-500)] text-[color:var(--color-warning-700)]"
        : "bg-[var(--secondary)] border-[var(--border)] text-[var(--foreground)]"
    )}>
      {critical && <AlertTriangle className="h-3.5 w-3.5" />}
      {formatCountdown(secs)}
    </div>
  )
})

// ─── Question Paper (left panel) ─────────────────────────────────────────────
const QuestionPaper = memo(function QuestionPaper({
  questions, answers, activeIdx, onQuestionVisible,
}: {
  questions: ShuffledQuestion[]
  answers: Record<string, string>
  activeIdx: number
  onQuestionVisible: (idx: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  // IntersectionObserver — fires when a question enters the viewport
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute("data-idx"))
            if (!isNaN(idx)) onQuestionVisible(idx)
          }
        })
      },
      { root: container, threshold: 0.5 }
    )
    container.querySelectorAll("[data-idx]").forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [questions, onQuestionVisible])

  return (
    <div ref={containerRef} className="h-full overflow-y-auto px-6 py-6 space-y-8 scroll-smooth">
      {/* Paper header */}
      <div className="text-center border-b-2 border-[var(--border)] pb-5">
        <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-1">Question Paper</p>
        <p className="text-sm text-[var(--muted-foreground)]">Read all questions carefully. Mark your answers on the OMR sheet.</p>
      </div>

      {questions.map((q, idx) => {
        const answered = !!answers[q.id]
        return (
          <div
            key={q.id}
            id={`omr-q-${idx}`}
            data-idx={idx}
            className={cn(
              "group relative pl-5 border-l-4 transition-colors duration-200",
              answered
                ? "border-[var(--primary)]"
                : "border-[var(--border)]"
            )}
          >
            {/* Question number badge */}
            <div className="flex items-start gap-3 mb-3">
              <span className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold border-2 transition-colors",
                answered
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                  : "border-[var(--border)] text-[var(--muted-foreground)]"
              )}>
                {idx + 1}
              </span>
              <p className="text-sm font-medium leading-relaxed pt-0.5">{q.question_text}</p>
            </div>

            {/* Options — read-only display, visual only */}
            <div className="ml-10 grid grid-cols-1 gap-1.5">
              {[
                { label: "A", text: q.option_a },
                { label: "B", text: q.option_b },
                { label: "C", text: q.option_c },
                { label: "D", text: q.option_d },
              ].map(({ label, text }) => (
                <div key={label} className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
                  <span className="font-semibold shrink-0 w-5 text-[var(--foreground)]">{label}.</span>
                  <span className="leading-relaxed">{text}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Bottom padding so last question can scroll to top */}
      <div className="h-32" />
    </div>
  )
})

// ─── OMR Bubble ──────────────────────────────────────────────────────────────
const OMRBubble = memo(function OMRBubble({
  label, filled, active, onClick,
}: { label: string; filled: boolean; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={`Option ${label}`}
      className={cn(
        "relative flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-150 text-[10px] font-bold select-none",
        filled
          ? "border-[#1e293b] bg-[#1e293b] text-white shadow-inner"
          : active
          ? "border-[color:var(--color-brand-400)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-600)]"
          : "border-[#94a3b8] bg-white text-[#64748b] hover:border-[#475569] hover:bg-[#f1f5f9]"
      )}
    >
      {filled ? (
        // Filled: show a solid inner circle (pencil-filled OMR feel)
        <span className="absolute inset-[3px] rounded-full bg-[#1e293b]" />
      ) : (
        label
      )}
    </button>
  )
})

// ─── OMR Sheet (right panel) ──────────────────────────────────────────────────
const OMRSheet = memo(function OMRSheet({
  questions, answers, activeIdx, onBubbleClick, examTitle,
}: {
  questions: ShuffledQuestion[]
  answers: Record<string, string>
  activeIdx: number
  onBubbleClick: (questionId: string, answer: string, idx: number) => void
  examTitle: string
}) {
  const rowRefs = useRef<(HTMLDivElement | null)[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const answeredCount = Object.keys(answers).length
  const total = questions.length

  // Auto-scroll OMR to keep active row visible
  useEffect(() => {
    const row = rowRefs.current[activeIdx]
    const container = scrollRef.current
    if (!row || !container) return
    const rowTop = row.offsetTop
    const rowBottom = rowTop + row.offsetHeight
    const containerTop = container.scrollTop
    const containerBottom = containerTop + container.clientHeight
    if (rowTop < containerTop + 8 || rowBottom > containerBottom - 8) {
      container.scrollTo({ top: rowTop - container.clientHeight / 2, behavior: "smooth" })
    }
  }, [activeIdx])

  // Split into two columns for a realistic OMR grid feel
  const half = Math.ceil(total / 2)
  const col1 = questions.slice(0, half)
  const col2 = questions.slice(half)

  const OPTIONS = ["A", "B", "C", "D"] as const

  const renderRow = (q: ShuffledQuestion, idx: number) => {
    const isActive = idx === activeIdx
    return (
      <div
        key={q.id}
        ref={(el) => { rowRefs.current[idx] = el }}
        className={cn(
          "flex items-center gap-2 px-2 py-1 rounded-md transition-colors duration-150",
          isActive ? "bg-amber-50 ring-1 ring-amber-300" : "hover:bg-[#f8fafc]"
        )}
      >
        {/* Question number */}
        <span className={cn(
          "w-6 text-right text-[11px] font-semibold shrink-0 font-mono",
          answers[q.id] ? "text-[#1e293b]" : "text-[#94a3b8]"
        )}>
          {idx + 1}
        </span>
        {/* Bubbles */}
        <div className="flex items-center gap-1.5">
          {OPTIONS.map((opt) => (
            <OMRBubble
              key={opt}
              label={opt}
              filled={answers[q.id] === opt}
              active={isActive && !answers[q.id]}
              onClick={() => onBubbleClick(q.id, answers[q.id] === opt ? "" : opt, idx)}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#fffef5] border-l border-[var(--border)]">
      {/* OMR Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-[#e2d9b3] bg-[#fffef5]">
        <div className="text-center mb-2">
          <p className="text-[10px] uppercase tracking-widest text-[#64748b] font-semibold">OMR Answer Sheet</p>
          <p className="text-xs font-bold text-[#1e293b] mt-0.5 truncate">{examTitle}</p>
        </div>
        {/* Progress */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-[#e2e8f0] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#4f46e5] transition-all duration-300"
              style={{ width: `${Math.round((answeredCount / total) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-[#475569] shrink-0">
            {answeredCount}/{total}
          </span>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 mt-2 justify-center">
          <div className="flex items-center gap-1">
            <span className="flex h-4 w-4 rounded-full border-2 border-[#1e293b] bg-[#1e293b]" />
            <span className="text-[10px] text-[#475569]">Marked</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="flex h-4 w-4 rounded-full border-2 border-[#94a3b8] bg-white" />
            <span className="text-[10px] text-[#475569]">Not attempted</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="flex h-4 w-4 rounded-full border-2 border-amber-300 bg-amber-50" />
            <span className="text-[10px] text-[#475569]">Current</span>
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className="shrink-0 flex gap-0 px-2 pt-2 pb-1 border-b border-[#e2d9b3]">
        {[col1, col2].map((_, ci) => (
          <div key={ci} className={cn("flex-1 flex items-center gap-2 px-2", ci === 0 && col2.length > 0 ? "border-r border-[#e2d9b3] mr-1" : "")}>
            <span className="w-6 text-right text-[9px] font-bold text-[#94a3b8]">Q</span>
            <div className="flex gap-1.5">
              {["A","B","C","D"].map(l => (
                <span key={l} className="w-7 text-center text-[9px] font-bold text-[#94a3b8]">{l}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Rows — two columns side by side */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-1">
        <div className="flex gap-0">
          {/* Column 1 */}
          <div className={cn("flex-1 space-y-0.5", col2.length > 0 && "border-r border-[#e2d9b3] pr-1 mr-1")}>
            {col1.map((q, i) => renderRow(q, i))}
          </div>
          {/* Column 2 */}
          {col2.length > 0 && (
            <div className="flex-1 space-y-0.5">
              {col2.map((q, i) => renderRow(q, half + i))}
            </div>
          )}
        </div>
      </div>

      {/* OMR Footer — watermark */}
      <div className="shrink-0 px-4 py-2 border-t border-[#e2d9b3] text-center">
        <p className="text-[9px] text-[#cbd5e1] tracking-wider uppercase">
          Use black or blue pen · Do not fold this sheet
        </p>
      </div>
    </div>
  )
})

// ─── Mobile OMR Sheet (full-screen bubble grid) ───────────────────────────────
const MobileOMRSheet = memo(function MobileOMRSheet({
  questions, answers, activeIdx, onBubbleClick,
}: {
  questions: ShuffledQuestion[]
  answers: Record<string, string>
  activeIdx: number
  onBubbleClick: (questionId: string, answer: string, idx: number) => void
}) {
  const OPTIONS = ["A", "B", "C", "D"] as const
  const answeredCount = Object.keys(answers).length
  const total = questions.length

  return (
    <div className="h-full flex flex-col bg-[#fffef5]">
      {/* Progress */}
      <div className="px-4 py-2 bg-[#fffef5] border-b border-[#e2d9b3] text-center">
        <p className="text-[10px] uppercase tracking-widest text-[#64748b] mb-1">OMR Answer Sheet</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-[#e2e8f0] overflow-hidden">
            <div className="h-full rounded-full bg-[#4f46e5] transition-all duration-300"
              style={{ width: `${Math.round((answeredCount / total) * 100)}%` }} />
          </div>
          <span className="text-[10px] font-mono text-[#475569]">{answeredCount}/{total}</span>
        </div>
      </div>
      {/* Column headers */}
      <div className="px-4 py-1 flex items-center gap-3 text-[9px] font-bold text-[#94a3b8] border-b border-[#e2d9b3]">
        <span className="w-6 text-right">Q</span>
        {OPTIONS.map(l => <span key={l} className="w-7 text-center">{l}</span>)}
      </div>
      {/* All rows */}
      <div className="flex-1 overflow-y-auto px-4 py-1 space-y-0.5">
        {questions.map((q, idx) => {
          const isActive = idx === activeIdx
          return (
            <div key={q.id} className={cn(
              "flex items-center gap-3 px-2 py-1 rounded-md",
              isActive ? "bg-amber-50 ring-1 ring-amber-300" : ""
            )}>
              <span className={cn(
                "w-6 text-right text-[11px] font-semibold shrink-0 font-mono",
                answers[q.id] ? "text-[#1e293b]" : "text-[#94a3b8]"
              )}>{idx + 1}</span>
              <div className="flex items-center gap-1.5">
                {OPTIONS.map((opt) => (
                  <OMRBubble
                    key={opt}
                    label={opt}
                    filled={answers[q.id] === opt}
                    active={isActive && !answers[q.id]}
                    onClick={() => onBubbleClick(q.id, answers[q.id] === opt ? "" : opt, idx)}
                  />
                ))}
              </div>
            </div>
          )
        })}
        <div className="h-8" />
      </div>
    </div>
  )
})

// ─── Main OMRExamRoom ─────────────────────────────────────────────────────────
interface OMRExamRoomProps {
  data: StartResponse
}

function exitFullscreenAndNavigate(path: string, push: (p: string) => void) {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {}).finally(() => push(path))
  } else {
    push(path)
  }
}

export function OMRExamRoom({ data }: OMRExamRoomProps) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [timeWarning, setTimeWarning] = useState(false)
  const [mobileTab, setMobileTab] = useState<"paper" | "omr">("paper")
  const [activeIdx, setActiveIdx] = useState(0)
  const [showWebcamPrompt, setShowWebcamPrompt] = useState(true)
  const [webcamEnabled, setWebcamEnabled] = useState(false)
  const [fullscreenCountdown, setFullscreenCountdown] = useState(0)
  const [dismissedViolationId, setDismissedViolationId] = useState<string | null>(null)
  const submittingRef = useRef(false)
  const fsCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [state, dispatch] = useReducer(omrReducer, {
    answers: data.saved_answers ?? {},
    submitted: false,
  })

  // Force-submit on proctoring termination
  const handleTerminate = useCallback(async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    dispatch({ type: "SUBMIT" })
    try { await examQueries.submit(data.attempt_id) } catch { /* WS handles it */ }
    setTimeout(() => exitFullscreenAndNavigate(`/results/${data.attempt_id}`, router.push), 2000)
  }, [data.attempt_id, router])

  // WS hook — defined before proctoring so reportProctoring is available
  const handleAutoSubmit = useCallback(() => {
    if (submittingRef.current) return
    submittingRef.current = true
    dispatch({ type: "SUBMIT" })
    exitFullscreenAndNavigate(`/results/${data.attempt_id}`, router.push)
  }, [data.attempt_id, router])

  const { saveAnswer, reportProctoring } = useExamWS({
    attemptId: data.attempt_id,
    onTimeWarning: () => setTimeWarning(true),
    onAutoSubmitted: handleAutoSubmit,
    onSubmitted: () => exitFullscreenAndNavigate(`/results/${data.attempt_id}`, router.push),
  })

  // Proctoring hook
  const proctoring = useProctoring({
    attemptId: data.attempt_id,
    enabled: true,
    autoTerminateAt: 3,
    onReport: (type, severity, meta) => reportProctoring(type, severity, meta),
    onTerminate: handleTerminate,
  })

  // Webcam proctoring hook
  const webcam = useWebcamProctor({
    enabled: webcamEnabled,
    onNoFace: () => reportProctoring("no_face_detected", "critical"),
    onMultipleFaces: () => reportProctoring("multiple_faces", "critical"),
    onGazeAway: () => reportProctoring("gaze_away", "warn"),
  })

  // Report webcam denial
  useEffect(() => {
    if (webcam.denied) {
      reportProctoring("webcam_denied", "warn")
    }
  }, [webcam.denied, reportProctoring])

  // Fullscreen return countdown (10s before force-submit)
  useEffect(() => {
    if (!proctoring.isFullscreen && proctoring.violationCount > 0 && !proctoring.isTerminated) {
      setFullscreenCountdown(10)
      fsCountdownRef.current = setInterval(() => {
        setFullscreenCountdown((prev) => {
          if (prev <= 1) {
            if (fsCountdownRef.current) clearInterval(fsCountdownRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (fsCountdownRef.current) clearInterval(fsCountdownRef.current)
      setFullscreenCountdown(0)
    }
    return () => { if (fsCountdownRef.current) clearInterval(fsCountdownRef.current) }
  }, [proctoring.isFullscreen, proctoring.violationCount, proctoring.isTerminated])

  const handleBubbleClick = useCallback((questionId: string, answer: string, idx: number) => {
    dispatch({ type: "SET_ANSWER", questionId, answer })
    saveAnswer(questionId, answer)
    setActiveIdx(idx)
  }, [saveAnswer])

  const handleSubmitConfirmed = useCallback(async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setConfirmOpen(false)
    dispatch({ type: "SUBMIT" })
    try { await examQueries.submit(data.attempt_id) } catch { /* WS handles it */ }
    exitFullscreenAndNavigate(`/results/${data.attempt_id}`, router.push)
  }, [data.attempt_id, router])

  const scrollPaperToQuestion = useCallback((idx: number) => {
    const el = document.getElementById(`omr-q-${idx}`)
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const handleBubbleClickWithScroll = useCallback((questionId: string, answer: string, idx: number) => {
    handleBubbleClick(questionId, answer, idx)
    scrollPaperToQuestion(idx)
    setMobileTab("paper")
  }, [handleBubbleClick, scrollPaperToQuestion])

  const answeredCount = Object.keys(state.answers).length
  const total = data.questions.length

  // Latest undismissed violation for toast
  const toastViolation = proctoring.latestViolation?.id !== dismissedViolationId
    ? proctoring.latestViolation
    : null

  if (proctoring.isTerminated) {
    return <TerminationScreen violationCount={proctoring.criticalCount} />
  }

  if (state.submitted) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--background)]">
        <div className="text-center space-y-3">
          <div className="h-12 w-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-[var(--muted-foreground)]">Submitting your exam…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--background)] overflow-hidden">

      {/* ── Webcam permission prompt ── */}
      {showWebcamPrompt && (
        <WebcamPermissionModal
          onAllow={() => { setWebcamEnabled(true); setShowWebcamPrompt(false) }}
          onDeny={() => { reportProctoring("webcam_denied", "warn"); setShowWebcamPrompt(false) }}
        />
      )}

      {/* ── Fullscreen return modal ── */}
      {!proctoring.isFullscreen && fullscreenCountdown > 0 && (
        <FullscreenWarningModal
          countdown={fullscreenCountdown}
          onReenter={() => document.documentElement.requestFullscreen().catch(() => {})}
        />
      )}

      {/* ── Violation toast (top-right) ── */}
      {toastViolation && (
        <div className="fixed top-4 right-4 z-[9990]">
          <ViolationToast
            violation={toastViolation}
            onDismiss={() => setDismissedViolationId(toastViolation.id)}
          />
        </div>
      )}

      {/* ── Webcam PiP (bottom-right) ── */}
      <WebcamPiP webcam={webcam} />

      {/* ── Header ── */}
      <header className="flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 shrink-0 gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{data.exam_title}</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {answeredCount}/{total} answered · Mock Exam
          </p>
        </div>
        <ProctoringBadge
          violationCount={proctoring.violationCount}
          criticalCount={proctoring.criticalCount}
        />
        <OMRTimer expiresAt={data.expires_at} onExpire={handleAutoSubmit} />
        <Button size="sm" onClick={() => setConfirmOpen(true)} className="shrink-0">
          <Send className="h-3.5 w-3.5" />
          <span className="hidden sm:inline ml-1.5">Submit</span>
        </Button>
      </header>

      {/* ── Mobile Tab Bar ── */}
      <div className="lg:hidden flex border-b border-[var(--border)] bg-[var(--card)] shrink-0">
        <button
          onClick={() => setMobileTab("paper")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors border-b-2",
            mobileTab === "paper"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          )}
        >
          <FileText className="h-4 w-4" />
          Question Paper
        </button>
        <button
          onClick={() => setMobileTab("omr")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors border-b-2 relative",
            mobileTab === "omr"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          )}
        >
          <ClipboardList className="h-4 w-4" />
          OMR Sheet
          {answeredCount > 0 && (
            <span className="absolute top-1.5 right-6 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--primary)] text-[9px] font-bold text-white">
              {answeredCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Question Paper — desktop always visible, mobile conditional */}
        <div className={cn(
          "flex-1 overflow-hidden",
          mobileTab === "omr" ? "hidden lg:block" : "block"
        )}>
          <QuestionPaper
            questions={data.questions}
            answers={state.answers}
            activeIdx={activeIdx}
            onQuestionVisible={setActiveIdx}
          />
        </div>

        {/* Right: OMR Sheet — desktop fixed width, mobile full width */}
        <div className={cn(
          "overflow-hidden",
          // Desktop: fixed 380px panel
          "lg:w-[380px] lg:shrink-0 lg:block",
          // Mobile: full width, only shown on omr tab
          mobileTab === "omr" ? "flex-1 block" : "hidden lg:block"
        )}>
          {/* Desktop OMR */}
          <div className="hidden lg:flex h-full flex-col">
            <OMRSheet
              questions={data.questions}
              answers={state.answers}
              activeIdx={activeIdx}
              onBubbleClick={handleBubbleClickWithScroll}
              examTitle={data.exam_title}
            />
          </div>
          {/* Mobile OMR */}
          <div className="lg:hidden h-full">
            <MobileOMRSheet
              questions={data.questions}
              answers={state.answers}
              activeIdx={activeIdx}
              onBubbleClick={handleBubbleClick}
            />
          </div>
        </div>
      </div>

      {/* ── Mobile floating CTA: "Go to OMR" when on paper tab ── */}
      {mobileTab === "paper" && (
        <div className="lg:hidden fixed bottom-6 right-4 z-40">
          <button
            onClick={() => setMobileTab("omr")}
            className="flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg active:scale-95 transition-transform"
          >
            <ClipboardList className="h-4 w-4" />
            Mark Answer
            {answeredCount < total && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
                {total - answeredCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ── Time warning toast ── */}
      {timeWarning && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-[color:var(--color-warning-500)] text-white px-5 py-2.5 text-sm font-medium shadow-lg z-50 animate-bounce">
          <AlertTriangle className="h-4 w-4" />
          5 minutes remaining!
        </div>
      )}

      {/* ── Confirm submit dialog ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4" /> Submit Exam?
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-3">
                  <CheckCircle2 className="h-5 w-5 text-[color:var(--color-success-500)] shrink-0" />
                  <div>
                    <p className="font-medium text-[var(--foreground)]">{answeredCount} of {total} answered</p>
                    {total - answeredCount > 0 && (
                      <p className="text-[var(--muted-foreground)] text-xs">{total - answeredCount} unanswered will be marked incorrect</p>
                    )}
                  </div>
                </div>
                <p className="text-[var(--muted-foreground)]">Once submitted, you cannot change your answers.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Continue exam
            </Button>
            <Button onClick={handleSubmitConfirmed}>
              Submit now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
