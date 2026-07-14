"use client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { Plus, Send, Trash2, PlusCircle, ChevronRight, ChevronLeft, Shuffle, ListChecks, Loader2, Check, Search, BookOpen, X, RefreshCw, Eye, EyeOff } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/DataTable"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { examQueries, type Exam, type CreateExamInput, type ExamSet, type ExamSource, type Question } from "@/lib/queries/exams"
import { formatDate } from "@/lib/utils"

// ─── Augmented local source type ─────────────────────────────────────────────
// `_mode` and `_random_ids` are UI-only — stripped before submission
type SourceMode = "full" | "random" | "manual"
interface LocalSource extends ExamSource {
  _mode: SourceMode
  _random_ids: string[] // IDs fetched by the random-pick algorithm
}
function toLocalSource(src: ExamSource, bankTotal?: number): LocalSource {
  // Backend always sends pinned_question_ids ([] or [...ids]) — never undefined
  const pinnedCount = src.pinned_question_ids?.length ?? 0
  if (pinnedCount > 0) return { ...src, _mode: "manual", _random_ids: [] }
  // Empty pinned_question_ids: distinguish full vs random by comparing question_count to bank total
  if (bankTotal !== undefined && src.question_count < bankTotal) return { ...src, _mode: "random", _random_ids: [] }
  return { ...src, _mode: "full", _random_ids: [] }
}
function toExamSource(ls: LocalSource): ExamSource {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _mode, _random_ids, ...rest } = ls
  if (_mode === "random") return { ...rest, pinned_question_ids: [] }
  if (_mode === "manual") return { ...rest }
  // full
  return { ...rest, pinned_question_ids: [] }
}
// ─── Constants ───────────────────────────────────────────────────────────────

const EXAM_TYPES = ["mock", "practice"] as const
const STATUS_OPTIONS = [
  { value: "draft", label: "Draft", desc: "Not visible to students" },
  { value: "active", label: "Active", desc: "Visible and available" },
] as const

const DEFAULT_FORM: CreateExamInput = {
  title: "", description: "", exam_type: "mock",
  duration_minutes: 60, pass_mark_pct: 40,
  marks_per_question: 1, negative_marking: false, negative_penalty: 0.25,
  shuffle: true, status: "draft", sources: [],
}

// ─── Difficulty pill ─────────────────────────────────────────────────────────

function DiffPill({ d }: { d: string }) {
  return (
    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
      d === "hard" ? "bg-red-100 text-red-700" : d === "easy" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
    )}>{d}</span>
  )
}

// ─── Question Picker Modal ───────────────────────────────────────────────────

function QuestionPickerModal({
  bank,
  questions,
  selected,
  excludedIds, // IDs already claimed by the other mode
  onConfirm,
  onClose,
}: {
  bank: ExamSet
  questions: Question[]
  selected: string[]
  excludedIds: string[]
  onConfirm: (ids: string[]) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState("")
  const [picks, setPicks] = useState<Set<string>>(new Set(selected))

  const available = questions.filter((q) => !excludedIds.includes(q.id))
  const filtered = available.filter((q) =>
    q.question_text.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (id: string) => {
    setPicks((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => setPicks(new Set(filtered.map((q) => q.id)))
  const clearAll = () => setPicks(new Set())

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div>
            <h2 className="text-base font-semibold">{bank.name}</h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              {picks.size} selected · {excludedIds.length > 0 && <span className="text-orange-500">{excludedIds.length} reserved by random pick · </span>}{available.length} available
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={selectAll} className="text-xs text-[var(--primary)] hover:underline font-medium">All</button>
            <span className="text-[var(--muted-foreground)] text-xs">·</span>
            <button onClick={clearAll} className="text-xs text-[var(--muted-foreground)] hover:underline">None</button>
          </div>
        </div>
        {/* Search */}
        <div className="px-5 pb-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            <Input className="pl-9 h-9 text-sm" placeholder="Search questions…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <Separator />
        {/* Question list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-[var(--muted-foreground)] py-10">No questions found</p>
          ) : filtered.map((q) => {
            const checked = picks.has(q.id)
            return (
              <button
                key={q.id}
                onClick={() => toggle(q.id)}
                className={cn(
                  "w-full text-left flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
                  checked ? "bg-[var(--primary)]/8 border border-[var(--primary)]/25" : "hover:bg-[var(--secondary)] border border-transparent"
                )}
              >
                <div className={cn(
                  "mt-0.5 flex-shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-colors",
                  checked ? "bg-[var(--primary)] border-[var(--primary)]" : "border-[var(--border)]"
                )}>
                  {checked && <Check className="h-2.5 w-2.5 text-white stroke-[3]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug line-clamp-2">{q.question_text}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <DiffPill d={q.difficulty} />
                    <span className="text-[10px] text-[var(--muted-foreground)]">Ans: {q.correct_option}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        <Separator />
        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0">
          <span className="text-sm text-[var(--muted-foreground)]">{picks.size} selected</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={() => onConfirm(Array.from(picks))} disabled={picks.size === 0}>
              <Check className="h-3.5 w-3.5" /> Confirm {picks.size > 0 ? `(${picks.size})` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Inline question list ─────────────────────────────────────────────────────

function InlineQuestionList({ questions, ids, label, accent }: {
  questions: Question[]
  ids: string[]
  label: string
  accent: "primary" | "orange"
}) {
  const [expanded, setExpanded] = useState(false)
  const shown = questions.filter((q) => ids.includes(q.id))
  if (shown.length === 0) return null
  const accentCls = accent === "primary"
    ? { bg: "bg-[var(--primary)]/6", border: "border-[var(--primary)]/20", text: "text-[var(--primary)]", dot: "bg-[var(--primary)]" }
    : { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-600", dot: "bg-orange-400" }
  return (
    <div className={cn("rounded-lg border px-3 py-2 space-y-2", accentCls.bg, accentCls.border)}>
      <button
        type="button"
        className="w-full flex items-center justify-between"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <div className={cn("h-2 w-2 rounded-full shrink-0", accentCls.dot)} />
          <span className={cn("text-xs font-semibold", accentCls.text)}>{label}</span>
          <span className={cn("text-xs font-mono", accentCls.text)}>({shown.length})</span>
        </div>
        {expanded
          ? <EyeOff className={cn("h-3.5 w-3.5", accentCls.text)} />
          : <Eye className={cn("h-3.5 w-3.5", accentCls.text)} />
        }
      </button>
      {expanded && (
        <div className="space-y-1 pt-1">
          {shown.map((q, i) => (
            <div key={q.id} className="flex items-start gap-2">
              <span className={cn("text-[10px] font-mono font-bold w-5 shrink-0 pt-0.5", accentCls.text)}>{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-snug line-clamp-2 text-[var(--foreground)]">{q.question_text}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <DiffPill d={q.difficulty} />
                  <span className="text-[9px] text-[var(--muted-foreground)]">Ans: {q.correct_option}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Bank Source Row ──────────────────────────────────────────────────────────

function BankSourceRow({
  src,
  bank,
  examSets,
  usedBankIds,
  index,
  onChange,
  onRemove,
}: {
  src: LocalSource
  bank: ExamSet | undefined
  examSets: ExamSet[]
  usedBankIds: string[]
  index: number
  onChange: (patch: Partial<LocalSource>) => void
  onRemove: () => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const max = bank?.question_count ?? 9999
  const mode = src._mode

  // Fetch all bank questions eagerly so we can do client-side random pick & show inline lists
  const { data: allQuestions = [], isLoading: qLoading } = useQuery({
    queryKey: ["bank-questions-picker", src.bank_id],
    queryFn: () => examQueries.fetchBankQuestions(src.bank_id),
    enabled: !!src.bank_id,
  })

  // ── random pick helper ────────────────────────────────────────────────────
  const doRandomPick = useCallback((count: number, excludePinned: string[]) => {
    const pool = allQuestions.filter((q) => !excludePinned.includes(q.id))
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, Math.min(count, shuffled.length)).map((q) => q.id)
  }, [allQuestions])

  // Auto-populate _random_ids once bank questions load (covers edit-page reload)
  useEffect(() => {
    if (mode === "random" && src._random_ids.length === 0 && allQuestions.length > 0) {
      onChange({ _random_ids: doRandomPick(src.question_count, src.pinned_question_ids ?? []) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allQuestions.length, mode])

  // ── mode switch ───────────────────────────────────────────────────────────
  const handleModeChange = (next: SourceMode) => {
    if (next === mode) return
    if (next === "full") {
      // Reset to entire bank — keep both id lists so switching back restores them
      onChange({ _mode: "full", question_count: bank?.question_count ?? src.question_count })
    } else if (next === "random") {
      // Roll a fresh random lot, excluding any manually pinned IDs
      const pinned = src.pinned_question_ids ?? []
      const count = mode === "full" ? Math.min(10, max) : src.question_count
      const randomIds = doRandomPick(count, pinned)
      onChange({ _mode: "random", question_count: count, _random_ids: randomIds })
    } else {
      // manual — open picker, pre-excluding random IDs
      setShowPicker(true)
      // Don't change mode yet; mode changes after picker confirms
    }
  }

  // ── re-roll random ────────────────────────────────────────────────────────
  const handleReroll = () => {
    const pinned = src.pinned_question_ids ?? []
    const newIds = doRandomPick(src.question_count, pinned)
    onChange({ _random_ids: newIds })
  }

  // ── count change (random mode) ────────────────────────────────────────────
  const handleCountChange = (val: number) => {
    const v = Math.min(max, Math.max(1, val))
    const pinned = src.pinned_question_ids ?? []
    const newIds = doRandomPick(v, pinned)
    onChange({ question_count: v, _random_ids: newIds })
  }

  const MODES = [
    { key: "full" as SourceMode, icon: BookOpen, label: "Entire Bank", desc: `All ${bank?.question_count ?? "?"} Qs` },
    { key: "random" as SourceMode, icon: Shuffle, label: "Random Pick", desc: "Algorithm picks" },
    { key: "manual" as SourceMode, icon: ListChecks, label: "Manual Pick", desc: "I choose" },
  ]

  return (
    <>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
        {/* Bank selector */}
        <div className="flex items-center gap-3">
          <select
            className="flex-1 h-9 rounded-[var(--radius)] border border-[var(--input)] bg-transparent px-3 text-sm font-medium"
            value={src.bank_id}
            onChange={(e) => {
              const es = examSets.find((s) => s.id === e.target.value)
              onChange({ bank_id: e.target.value, bank_name: es?.name ?? "", question_count: Math.min(10, es?.question_count ?? 10), pinned_question_ids: [], _mode: "full", _random_ids: [] })
            }}
          >
            {examSets.map((es) => (
              <option key={es.id} value={es.id} disabled={usedBankIds.includes(es.id) && es.id !== src.bank_id}>
                {es.name} ({es.question_count} questions)
              </option>
            ))}
          </select>
          <Button variant="ghost" size="icon-sm" onClick={onRemove} className="text-[color:var(--color-danger-500)] shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Mode tabs */}
        <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-[var(--secondary)] p-1">
          {MODES.map(({ key, icon: Icon, label, desc }) => (
            <button
              key={key}
              onClick={() => handleModeChange(key)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-md px-2 py-2 text-center transition-all",
                mode === key
                  ? "bg-[var(--background)] shadow-sm text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", mode === key && "text-[var(--primary)]")} />
              <span className="text-[11px] font-semibold leading-tight">{label}</span>
              <span className="text-[9px] leading-tight opacity-70">{desc}</span>
            </button>
          ))}
        </div>

        {/* ── Random mode body ── */}
        {mode === "random" && (
          <div className="space-y-2">
            {/* Count + reroll row */}
            <div className="flex items-center gap-3">
              <Label className="text-xs shrink-0 text-[var(--muted-foreground)]">Pick</Label>
              <Input
                type="number" min={1} max={max}
                className="h-8 text-sm w-20"
                value={src.question_count}
                onChange={(e) => handleCountChange(Number(e.target.value))}
              />
              <span className="text-xs text-[var(--muted-foreground)]">of {bank?.question_count ?? "?"}</span>
              {src.question_count > max && <span className="text-xs text-red-500 font-medium">Exceeds bank size!</span>}
              <div className="flex-1" />
              <Button
                variant="outline" size="sm" className="h-7 text-xs gap-1"
                onClick={handleReroll}
                disabled={qLoading || allQuestions.length === 0}
              >
                <RefreshCw className="h-3 w-3" /> Pick Again
              </Button>
            </div>
            {/* Inline list of randomly picked questions */}
            {qLoading
              ? <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]"><Loader2 className="h-3 w-3 animate-spin" />Fetching questions…</div>
              : src._random_ids.length > 0
                ? <InlineQuestionList questions={allQuestions} ids={src._random_ids} label="Randomly selected questions" accent="orange" />
                : <p className="text-xs text-[var(--muted-foreground)] italic">Click Pick Again to fetch a lot</p>
            }
          </div>
        )}

        {/* ── Manual mode body ── */}
        {mode === "manual" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">
                {(src.pinned_question_ids?.length ?? 0) > 0
                  ? `${src.pinned_question_ids!.length} questions selected`
                  : "No questions selected yet"}
              </span>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowPicker(true)}>
                <ListChecks className="h-3 w-3" />
                {(src.pinned_question_ids?.length ?? 0) > 0 ? "Edit selection" : "Choose questions"}
              </Button>
            </div>
            {(src.pinned_question_ids?.length ?? 0) > 0 && (
              <InlineQuestionList questions={allQuestions} ids={src.pinned_question_ids!} label="Manually selected questions" accent="primary" />
            )}
          </div>
        )}

        {/* ── Full mode body ── */}
        {mode === "full" && bank && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2">
            <BookOpen className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            <span className="text-xs text-[var(--muted-foreground)]">All <span className="font-semibold text-[var(--foreground)]">{bank.question_count}</span> questions from this bank will be included</span>
          </div>
        )}
      </div>

      {/* Manual picker modal */}
      {showPicker && bank && (
        <QuestionPickerModal
          bank={bank}
          questions={allQuestions}
          selected={src.pinned_question_ids ?? []}
          excludedIds={src._random_ids} // random IDs are off-limits for manual
          onConfirm={(ids) => {
            onChange({ _mode: "manual", pinned_question_ids: ids, question_count: ids.length })
            setShowPicker(false)
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}

// ─── Sources Editor ───────────────────────────────────────────────────────────

function SourcesEditor({ sources, onChange, examSets }: {
  sources: ExamSource[]
  onChange: (s: ExamSource[]) => void
  examSets: ExamSet[]
}) {
  const hydrate = useCallback((srcs: ExamSource[]) =>
    srcs.map((s) => toLocalSource(s, examSets.find((es) => es.id === s.bank_id)?.question_count))
  , [examSets])

  // Lift ExamSource[] ↔ LocalSource[] conversion here
  const [localSources, setLocalSources] = useState<LocalSource[]>(() => hydrate(sources))

  // Sync local → parent on every change
  const updateLocal = (next: LocalSource[]) => {
    setLocalSources(next)
    onChange(next.map(toExamSource))
  }

  // Re-sync when sources arrive (async on edit page) or when examSets load (needed for bankTotal)
  const sourcesKey = sources.map((s) => s.bank_id).join(",")
  const setsReady = examSets.length > 0
  useEffect(() => {
    if (sources.length > 0 && setsReady) setLocalSources(hydrate(sources))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourcesKey, setsReady])

  const usedBankIds = localSources.map((s) => s.bank_id)
  const totalQ = localSources.reduce((a, s) => a + s.question_count, 0)

  const addBank = () => {
    const unused = examSets.find((es) => !usedBankIds.includes(es.id))
    if (!unused) return
    updateLocal([...localSources, toLocalSource({ bank_id: unused.id, bank_name: unused.name, question_count: Math.min(10, unused.question_count) }, unused.question_count)])
  }

  const update = (i: number, patch: Partial<LocalSource>) => {
    updateLocal(localSources.map((s, idx) => idx !== i ? s : { ...s, ...patch }))
  }

  const remove = (i: number) => updateLocal(localSources.filter((_, idx) => idx !== i))

  if (examSets.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-[var(--border)] p-8 text-center">
        <BookOpen className="h-8 w-8 mx-auto text-[var(--muted-foreground)] mb-2" />
        <p className="text-sm font-medium text-[var(--muted-foreground)]">No question banks yet</p>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">Create banks in the Question Banks section first</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Question Bank Sources</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Define which banks contribute questions and how they're selected</p>
        </div>
        {totalQ > 0 && (
          <div className="text-right">
            <p className="text-lg font-bold text-[var(--primary)] leading-none">{totalQ}</p>
            <p className="text-[10px] text-[var(--muted-foreground)]">total questions</p>
          </div>
        )}
      </div>

      {localSources.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[var(--border)] p-6 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">No banks added yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {localSources.map((src, i) => (
            <BankSourceRow
              key={`${src.bank_id}-${i}`}
              src={src}
              bank={examSets.find((es) => es.id === src.bank_id)}
              examSets={examSets}
              usedBankIds={usedBankIds}
              index={i}
              onChange={(patch) => update(i, patch)}
              onRemove={() => remove(i)}
            />
          ))}
        </div>
      )}

      <Button
        variant="outline" size="sm" className="w-full border-dashed"
        onClick={addBank}
        disabled={localSources.length >= examSets.length}
      >
        <PlusCircle className="h-3.5 w-3.5" /> Add Question Bank
      </Button>
    </div>
  )
}

// ─── Create Exam Wizard ───────────────────────────────────────────────────────

function CreateExamWizard({ examSets, onClose, onCreated }: {
  examSets: ExamSet[]
  onClose: () => void
  onCreated: () => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [form, setForm] = useState<CreateExamInput>(DEFAULT_FORM)
  const set = useCallback(<K extends keyof CreateExamInput>(k: K, v: CreateExamInput[K]) => setForm((f) => ({ ...f, [k]: v })), [])

  const createMutation = useMutation({
    mutationFn: () => examQueries.create(form),
    onSuccess: () => { onCreated(); onClose() },
  })

  const step1Valid = form.title.trim().length > 0
  const step2Valid = form.sources.length > 0 && form.sources.every((s) => s.question_count > 0)
  const totalQ = form.sources.reduce((a, s) => a + s.question_count, 0)

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0">
        {/* Wizard header */}
        <div className="flex items-center gap-4 px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-2 flex-1">
            {/* Step indicator */}
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                  step === s ? "bg-[var(--primary)] text-white" :
                  step > s ? "bg-[var(--primary)]/15 text-[var(--primary)]" :
                  "bg-[var(--secondary)] text-[var(--muted-foreground)]"
                )}>
                  {step > s ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : s}
                </div>
                <span className={cn("text-sm font-medium hidden sm:block",
                  step === s ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
                )}>
                  {s === 1 ? "Exam Details" : "Question Banks"}
                </span>
                {s < 2 && <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)]" />}
              </div>
            ))}
          </div>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <Separator />

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label>Title <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g. SSC CGL Mock Test 1" value={form.title} onChange={(e) => set("title", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input placeholder="Optional description…" value={form.description} onChange={(e) => set("description", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Exam Type</Label>
                  <select
                    className="flex h-10 w-full rounded-[var(--radius)] border border-[var(--input)] bg-transparent px-3 text-sm"
                    value={form.exam_type}
                    onChange={(e) => set("exam_type", e.target.value as CreateExamInput["exam_type"])}
                  >
                    {EXAM_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <select
                    className="flex h-10 w-full rounded-[var(--radius)] border border-[var(--input)] bg-transparent px-3 text-sm"
                    value={form.status}
                    onChange={(e) => set("status", e.target.value as CreateExamInput["status"])}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label} — {s.desc}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Duration (minutes)</Label>
                  <Input type="number" min={1} value={form.duration_minutes} onChange={(e) => set("duration_minutes", Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Pass Mark %</Label>
                  <Input type="number" min={1} max={100} value={form.pass_mark_pct} onChange={(e) => set("pass_mark_pct", Number(e.target.value))} />
                </div>
              </div>
              {/* Marking scheme */}
              <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
                <p className="text-sm font-semibold">Marking Scheme</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Marks per Correct Answer</Label>
                    <Input type="number" min={0.25} step={0.25} value={form.marks_per_question} onChange={(e) => set("marks_per_question", Number(e.target.value))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className={cn(!form.negative_marking && "text-[var(--muted-foreground)]")} >Negative Penalty per Wrong</Label>
                    <Input type="number" min={0} step={0.25} value={form.negative_penalty} disabled={!form.negative_marking} onChange={(e) => set("negative_penalty", Number(e.target.value))} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => set("negative_marking", !form.negative_marking)}
                  className={cn(
                    "w-full flex items-center gap-4 rounded-xl border-2 px-4 py-3 text-left transition-colors",
                    form.negative_marking ? "border-red-400/50 bg-red-50" : "border-[var(--border)] hover:border-red-200"
                  )}
                >
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-full shrink-0",
                    form.negative_marking ? "bg-red-100" : "bg-[var(--secondary)]"
                  )}>
                    <span className={cn("text-base font-bold leading-none", form.negative_marking ? "text-red-600" : "text-[var(--muted-foreground)]")}>−</span>
                  </div>
                  <div className="flex-1">
                    <p className={cn("text-sm font-semibold", form.negative_marking ? "text-red-700" : "text-[var(--foreground)]")}>Negative Marking</p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                      {form.negative_marking ? `−${form.negative_penalty} marks deducted per wrong answer` : "No penalty for wrong answers"}
                    </p>
                  </div>
                  <div className={cn("h-5 w-9 rounded-full transition-colors relative shrink-0",
                    form.negative_marking ? "bg-red-500" : "bg-[var(--border)]"
                  )}>
                    <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                      form.negative_marking ? "left-[calc(100%-18px)]" : "left-0.5"
                    )} />
                  </div>
                </button>
              </div>
              {/* Shuffle toggle — card style */}
              <button
                type="button"
                onClick={() => set("shuffle", !form.shuffle)}
                className={cn(
                  "w-full flex items-center gap-4 rounded-xl border-2 px-4 py-3 text-left transition-colors",
                  form.shuffle ? "border-[var(--primary)]/40 bg-[var(--primary)]/5" : "border-[var(--border)] hover:border-[var(--primary)]/25"
                )}
              >
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-full shrink-0",
                  form.shuffle ? "bg-[var(--primary)]/15" : "bg-[var(--secondary)]"
                )}>
                  <Shuffle className={cn("h-4 w-4", form.shuffle ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]")} />
                </div>
                <div className="flex-1">
                  <p className={cn("text-sm font-semibold", form.shuffle ? "text-[var(--primary)]" : "text-[var(--foreground)]")}>Shuffle Questions</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Questions from all banks are intermixed randomly per attempt</p>
                </div>
                <div className={cn("h-5 w-9 rounded-full transition-colors relative shrink-0",
                  form.shuffle ? "bg-[var(--primary)]" : "bg-[var(--border)]"
                )}>
                  <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                    form.shuffle ? "left-[calc(100%-18px)]" : "left-0.5"
                  )} />
                </div>
              </button>
            </div>
          )}

          {step === 2 && (
            <SourcesEditor
              sources={form.sources}
              onChange={(sources) => set("sources", sources)}
              examSets={examSets}
            />
          )}
        </div>

        <Separator />
        {/* Footer nav */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0">
          <div>
            {step === 2 && totalQ > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
                <span className="font-bold text-[var(--foreground)]">{totalQ}</span> questions across <span className="font-bold text-[var(--foreground)]">{form.sources.length}</span> {form.sources.length === 1 ? "bank" : "banks"}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === 1 ? (
              <>
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={() => setStep(2)} disabled={!step1Valid}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !step2Valid}
                >
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Create Exam
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Exams list columns ───────────────────────────────────────────────────────

const columns = (
  onPublish: (id: string) => void,
  onDelete: (id: string) => void,
  publishing: string | null,
): ColumnDef<Exam>[] => [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => (
      <Link href={`/exams/${row.original.id}`} className="font-medium text-sm hover:text-[var(--primary)] hover:underline">
        {row.original.title}
      </Link>
    ),
  },
  { accessorKey: "exam_type", header: "Type", cell: ({ row }) => <Badge variant="brand" className="capitalize">{row.original.exam_type}</Badge> },
  {
    accessorKey: "sources",
    header: "Banks",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {(row.original.sources ?? []).map((s) => (
          <span key={s.bank_id} className="text-xs bg-[var(--secondary)] px-1.5 py-0.5 rounded">
            {s.bank_name} ×{s.question_count}
          </span>
        ))}
      </div>
    ),
  },
  { accessorKey: "total_questions", header: "Total Qs", cell: ({ row }) => <span className="font-mono text-sm">{row.original.total_questions}</span> },
  { accessorKey: "duration_minutes", header: "Duration", cell: ({ row }) => <span className="text-sm">{row.original.duration_minutes} min</span> },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  { accessorKey: "created_at", header: "Created", cell: ({ row }) => <span className="text-xs text-[var(--muted-foreground)]">{formatDate(row.original.created_at)}</span> },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/exams/${row.original.id}`}>Edit</Link>
        </Button>
        {row.original.status !== "active" && (
          <Button size="sm" variant="ocean" disabled={publishing === row.original.id} onClick={() => onPublish(row.original.id)}>
            <Send className="h-3.5 w-3.5" /> Publish
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" onClick={() => onDelete(row.original.id)}>
          <Trash2 className="h-4 w-4 text-[color:var(--color-danger-500)]" />
        </Button>
      </div>
    ),
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExamsPage() {
  const qc = useQueryClient()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [publishing, setPublishing] = useState<string | null>(null)

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["admin-exams"],
    queryFn: examQueries.list,
  })

  const { data: examSets = [] } = useQuery({
    queryKey: ["exam-sets"],
    queryFn: examQueries.examSets,
  })

  const publishMutation = useMutation({
    mutationFn: (id: string) => examQueries.publish(id),
    onMutate: (id) => setPublishing(id),
    onSettled: () => { setPublishing(null); qc.invalidateQueries({ queryKey: ["admin-exams"] }) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => examQueries.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-exams"] }),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exams"
        description={`${exams.length} exam${exams.length !== 1 ? "s" : ""}`}
        action={
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4" /> Create Exam
          </Button>
        }
      />
      <DataTable
        columns={columns(publishMutation.mutate, deleteMutation.mutate, publishing)}
        data={exams}
        isLoading={isLoading}
        searchKey="title"
        searchPlaceholder="Search exams…"
      />

      {wizardOpen && (
        <CreateExamWizard
          examSets={examSets}
          onClose={() => setWizardOpen(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["admin-exams"] })}
        />
      )}
    </div>
  )
}
