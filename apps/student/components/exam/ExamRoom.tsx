"use client"
import { memo, useCallback, useReducer, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, ChevronLeft, ChevronRight, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { useCountdown } from "@/hooks/useCountdown"
import { useExamWS } from "@/hooks/useExamWS"
import { examQueries } from "@/lib/queries/exams"
import { formatCountdown, cn } from "@/lib/utils"
import type { StartResponse, ShuffledQuestion } from "@/lib/queries/exams"

// ─── Reducer ────────────────────────────────────────────────────────────────
interface ExamState {
  currentIdx: number
  answers: Record<string, string>
  submitted: boolean
}
type ExamAction =
  | { type: "SET_ANSWER"; questionId: string; answer: string }
  | { type: "NAVIGATE"; idx: number }
  | { type: "SUBMIT" }

function examReducer(state: ExamState, action: ExamAction): ExamState {
  switch (action.type) {
    case "SET_ANSWER":
      return { ...state, answers: { ...state.answers, [action.questionId]: action.answer } }
    case "NAVIGATE":
      return { ...state, currentIdx: action.idx }
    case "SUBMIT":
      return { ...state, submitted: true }
    default:
      return state
  }
}

// ─── Sub-components (memoized) ───────────────────────────────────────────────
const OptionButton = memo(function OptionButton({
  label, text, selected, onSelect,
}: { label: string; text: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all duration-[150ms]",
        selected
          ? "border-[var(--primary)] bg-[color:var(--color-brand-50)] text-[var(--primary)]"
          : "border-[var(--border)] hover:border-[var(--primary)]/40 hover:bg-[var(--secondary)]"
      )}
    >
      <span className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold border-2 transition-colors",
        selected ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)]"
      )}>
        {label}
      </span>
      <span className="text-sm leading-relaxed">{text}</span>
    </button>
  )
})

const QuestionPanel = memo(function QuestionPanel({
  question, selectedAnswer, onAnswer,
}: { question: ShuffledQuestion; selectedAnswer?: string; onAnswer: (qId: string, ans: string) => void }) {
  const options = [
    { label: "A", text: question.option_a },
    { label: "B", text: question.option_b },
    { label: "C", text: question.option_c },
    { label: "D", text: question.option_d },
  ]
  return (
    <div className="space-y-4">
      <p className="text-base font-medium leading-relaxed">{question.question_text}</p>
      <div className="space-y-2.5">
        {options.map(({ label, text }) => (
          <OptionButton
            key={label}
            label={label}
            text={text}
            selected={selectedAnswer === label}
            onSelect={() => onAnswer(question.id, label)}
          />
        ))}
      </div>
    </div>
  )
})

const QuestionNav = memo(function QuestionNav({
  questions, answers, currentIdx, onNavigate,
}: { questions: ShuffledQuestion[]; answers: Record<string, string>; currentIdx: number; onNavigate: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {questions.map((q, i) => {
        const answered = !!answers[q.id]
        const current = i === currentIdx
        return (
          <button
            key={q.id}
            onClick={() => onNavigate(i)}
            className={cn(
              "h-8 w-8 rounded-lg text-xs font-semibold transition-all",
              current
                ? "bg-[var(--primary)] text-white ring-2 ring-[var(--primary)]/30"
                : answered
                ? "bg-[color:var(--color-success-500)] text-white"
                : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            )}
          >
            {i + 1}
          </button>
        )
      })}
    </div>
  )
})

const ExamTimer = memo(function ExamTimer({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const secs = useCountdown(expiresAt, onExpire)
  const critical = secs < 60
  const pct = Math.max(0, (secs / (secs + 1)) * 100) // keeps bar moving
  return (
    <div className={cn("flex items-center gap-2 text-sm font-mono font-bold", critical && "text-[var(--destructive)] animate-pulse")}>
      {critical && <AlertTriangle className="h-4 w-4" />}
      {formatCountdown(secs)}
    </div>
  )
})

function exitFullscreenAndNavigate(path: string, push: (p: string) => void) {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {}).finally(() => push(path))
  } else {
    push(path)
  }
}

// ─── Main component ──────────────────────────────────────────────────────────
interface ExamRoomProps {
  data: StartResponse
}

export function ExamRoom({ data }: ExamRoomProps) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [timeWarning, setTimeWarning] = useState(false)
  const submittingRef = useRef(false)

  const [state, dispatch] = useReducer(examReducer, {
    currentIdx: 0,
    answers: data.saved_answers ?? {},
    submitted: false,
  })

  const handleAnswer = useCallback((qId: string, ans: string) => {
    dispatch({ type: "SET_ANSWER", questionId: qId, answer: ans })
    saveAnswer(qId, ans)
  }, []) // eslint-disable-line

  const handleSubmitConfirmed = useCallback(async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setConfirmOpen(false)
    dispatch({ type: "SUBMIT" })
    try {
      await examQueries.submit(data.attempt_id)
    } catch {}
    exitFullscreenAndNavigate(`/results/${data.attempt_id}`, router.push)
  }, [data.attempt_id, router])

  const handleAutoSubmit = useCallback(() => {
    if (submittingRef.current) return
    submittingRef.current = true
    dispatch({ type: "SUBMIT" })
    exitFullscreenAndNavigate(`/results/${data.attempt_id}`, router.push)
  }, [data.attempt_id, router])

  const { saveAnswer, submitExam } = useExamWS({
    attemptId: data.attempt_id,
    onTimeWarning: () => setTimeWarning(true),
    onAutoSubmitted: handleAutoSubmit,
    onSubmitted: () => exitFullscreenAndNavigate(`/results/${data.attempt_id}`, router.push),
  })

  const q = data.questions[state.currentIdx]
  const answeredCount = Object.keys(state.answers).length
  const total = data.questions.length
  const progressPct = Math.round((answeredCount / total) * 100)

  if (state.submitted) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <div className="h-10 w-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-[var(--muted-foreground)]">Submitting your exam…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--background)] overflow-hidden">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{data.exam_title}</p>
          <p className="text-xs text-[var(--muted-foreground)]">Q{state.currentIdx + 1} of {total}</p>
        </div>
        <div className="flex items-center gap-4">
          <ExamTimer expiresAt={data.expires_at} onExpire={handleAutoSubmit} />
          <Button size="sm" onClick={() => setConfirmOpen(true)}>
            <Send className="h-3.5 w-3.5" /> Submit
          </Button>
        </div>
      </header>

      {/* Progress */}
      <div className="px-4 py-1.5 bg-[var(--card)] border-b border-[var(--border)]">
        <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] mb-1">
          <span>{answeredCount} of {total} answered</span>
          <span>{progressPct}%</span>
        </div>
        <Progress value={progressPct} />
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Question */}
        <div className="flex-1 overflow-y-auto p-6">
          <QuestionPanel
            question={q}
            selectedAnswer={state.answers[q.id]}
            onAnswer={handleAnswer}
          />
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:flex w-64 flex-col border-l border-[var(--border)] bg-[var(--card)] p-4 gap-4 overflow-y-auto shrink-0">
          <div>
            <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Questions</p>
            <QuestionNav
              questions={data.questions}
              answers={state.answers}
              currentIdx={state.currentIdx}
              onNavigate={(i) => dispatch({ type: "NAVIGATE", idx: i })}
            />
          </div>
          <div className="flex flex-col gap-1.5 text-xs text-[var(--muted-foreground)]">
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-[color:var(--color-success-500)] inline-block" /> Answered</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-[var(--secondary)] inline-block" /> Not answered</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-[var(--primary)] inline-block" /> Current</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-auto border-[var(--destructive)] text-[var(--destructive)] hover:bg-[color:var(--color-danger-50)]"
            onClick={() => setConfirmOpen(true)}
          >
            <Send className="h-3.5 w-3.5" /> Submit Exam
          </Button>
        </aside>
      </div>

      {/* Footer nav */}
      <footer className="flex h-14 items-center justify-between border-t border-[var(--border)] bg-[var(--card)] px-4 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => dispatch({ type: "NAVIGATE", idx: state.currentIdx - 1 })}
          disabled={state.currentIdx === 0}
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => dispatch({ type: "NAVIGATE", idx: state.currentIdx + 1 })}
          disabled={state.currentIdx === total - 1}
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </footer>

      {/* Time warning toast */}
      {timeWarning && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-[color:var(--color-warning-500)] text-white px-4 py-2 text-sm font-medium shadow-lg z-50">
          <AlertTriangle className="h-4 w-4" /> 5 minutes remaining!
        </div>
      )}

      {/* Confirm submit dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Submit Exam?</DialogTitle>
            <DialogDescription>
              You have answered <strong>{answeredCount}</strong> of <strong>{total}</strong> questions.{" "}
              {total - answeredCount > 0 && `${total - answeredCount} unanswered question(s) will be marked wrong.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Continue exam</Button>
            <Button onClick={handleSubmitConfirmed}>Submit now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
