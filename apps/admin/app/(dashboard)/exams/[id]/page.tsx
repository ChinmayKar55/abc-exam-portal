"use client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, Save, Loader2, Shuffle, Check, Search, BookOpen, ListChecks, X, PlusCircle, RefreshCw, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { PageHeader } from "@/components/shared/PageHeader"
import { cn } from "@/lib/utils"
import { examQueries, type CreateExamInput, type ExamSet, type ExamSource, type Question } from "@/lib/queries/exams"

// ─── LocalSource (UI-only augmentation, stripped before save) ──────────────────
type SourceMode = "full" | "random" | "manual"
interface LocalSource extends ExamSource {
  _mode: SourceMode
  _random_ids: string[]
}
function toLocalSource(src: ExamSource, bankTotal?: number): LocalSource {
  // Backend now always sends pinned_question_ids ([] or [...ids]) — never undefined
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
  return { ...rest }
}

// ─── Re-used sub-components (same logic as exams/page.tsx) ────────────────────

const EXAM_TYPES = ["mock", "practice"] as const
const STATUS_OPTIONS = [
  { value: "draft", label: "Draft — Not visible to students" },
  { value: "active", label: "Active — Visible and available" },
  { value: "archived", label: "Archived — Hidden from students" },
] as const

function DiffPill({ d }: { d: string }) {
  return (
    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
      d === "hard" ? "bg-red-100 text-red-700" : d === "easy" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
    )}>{d}</span>
  )
}

function InlineQuestionList({ questions, ids, label, accent }: {
  questions: Question[]; ids: string[]; label: string; accent: "primary" | "orange"
}) {
  const [expanded, setExpanded] = useState(false)
  const shown = questions.filter((q) => ids.includes(q.id))
  if (shown.length === 0) return null
  const a = accent === "primary"
    ? { bg: "bg-[var(--primary)]/6", border: "border-[var(--primary)]/20", text: "text-[var(--primary)]", dot: "bg-[var(--primary)]" }
    : { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-600", dot: "bg-orange-400" }
  return (
    <div className={cn("rounded-lg border px-3 py-2 space-y-2", a.bg, a.border)}>
      <button type="button" className="w-full flex items-center justify-between" onClick={() => setExpanded((v) => !v)}>
        <div className="flex items-center gap-2">
          <div className={cn("h-2 w-2 rounded-full shrink-0", a.dot)} />
          <span className={cn("text-xs font-semibold", a.text)}>{label}</span>
          <span className={cn("text-xs font-mono", a.text)}>({shown.length})</span>
        </div>
        {expanded ? <EyeOff className={cn("h-3.5 w-3.5", a.text)} /> : <Eye className={cn("h-3.5 w-3.5", a.text)} />}
      </button>
      {expanded && (
        <div className="space-y-1 pt-1">
          {shown.map((q, i) => (
            <div key={q.id} className="flex items-start gap-2">
              <span className={cn("text-[10px] font-mono font-bold w-5 shrink-0 pt-0.5", a.text)}>{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-snug line-clamp-2 text-[var(--foreground)]">{q.question_text}</p>
                <div className="flex items-center gap-1.5 mt-0.5"><DiffPill d={q.difficulty} /><span className="text-[9px] text-[var(--muted-foreground)]">Ans: {q.correct_option}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function QuestionPickerModal({ bank, questions, selected, excludedIds, onConfirm, onClose }: {
  bank: ExamSet; questions: Question[]; selected: string[]; excludedIds: string[]
  onConfirm: (ids: string[]) => void; onClose: () => void
}) {
  const [search, setSearch] = useState("")
  const [picks, setPicks] = useState<Set<string>>(new Set(selected))
  const available = questions.filter((q) => !excludedIds.includes(q.id))
  const filtered = available.filter((q) => q.question_text.toLowerCase().includes(search.toLowerCase()))
  const toggle = (id: string) => setPicks((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col p-0 gap-0">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div>
            <h2 className="text-base font-semibold">{bank.name}</h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              {picks.size} selected
              {excludedIds.length > 0 && <span className="text-orange-500"> · {excludedIds.length} reserved by random pick</span>}
              {" · "}{available.length} available
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPicks(new Set(filtered.map((q) => q.id)))} className="text-xs text-[var(--primary)] hover:underline font-medium">All</button>
            <span className="text-xs text-[var(--muted-foreground)]">·</span>
            <button onClick={() => setPicks(new Set())} className="text-xs text-[var(--muted-foreground)] hover:underline">None</button>
          </div>
        </div>
        <div className="px-5 pb-3 shrink-0">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted-foreground)]" /><Input className="pl-9 h-9 text-sm" placeholder="Search questions…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
        <Separator />
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {filtered.map((q) => {
            const checked = picks.has(q.id)
            return (
              <button key={q.id} onClick={() => toggle(q.id)} className={cn("w-full text-left flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors border", checked ? "bg-[var(--primary)]/8 border-[var(--primary)]/25" : "hover:bg-[var(--secondary)] border-transparent")}>
                <div className={cn("mt-0.5 flex-shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center", checked ? "bg-[var(--primary)] border-[var(--primary)]" : "border-[var(--border)]")}>
                  {checked && <Check className="h-2.5 w-2.5 text-white stroke-[3]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug line-clamp-2">{q.question_text}</p>
                  <div className="flex items-center gap-2 mt-1"><DiffPill d={q.difficulty} /><span className="text-[10px] text-[var(--muted-foreground)]">Ans: {q.correct_option}</span></div>
                </div>
              </button>
            )
          })}
        </div>
        <Separator />
        <div className="flex items-center justify-between px-5 py-3 shrink-0">
          <span className="text-sm text-[var(--muted-foreground)]">{picks.size} selected</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={() => onConfirm(Array.from(picks))} disabled={picks.size === 0}><Check className="h-3.5 w-3.5" /> Confirm {picks.size > 0 ? `(${picks.size})` : ""}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function BankSourceRow({ src, bank, examSets, usedBankIds, onChange, onRemove }: {
  src: LocalSource; bank: ExamSet | undefined; examSets: ExamSet[]; usedBankIds: string[]
  onChange: (patch: Partial<LocalSource>) => void; onRemove: () => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const max = bank?.question_count ?? 9999
  const mode = src._mode

  const { data: allQuestions = [], isLoading: qLoading } = useQuery({
    queryKey: ["bank-questions-picker", src.bank_id],
    queryFn: () => examQueries.fetchBankQuestions(src.bank_id),
    enabled: !!src.bank_id,
  })

  const doRandomPick = useCallback((count: number, excludePinned: string[]) => {
    const pool = allQuestions.filter((q) => !excludePinned.includes(q.id))
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, Math.min(count, shuffled.length)).map((q) => q.id)
  }, [allQuestions])

  // Auto-populate _random_ids once bank questions load (for existing exams loaded in edit mode)
  useEffect(() => {
    if (mode === "random" && src._random_ids.length === 0 && allQuestions.length > 0) {
      onChange({ _random_ids: doRandomPick(src.question_count, src.pinned_question_ids ?? []) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allQuestions.length, mode])

  const handleModeChange = (next: SourceMode) => {
    if (next === mode) return
    if (next === "full") {
      onChange({ _mode: "full", question_count: bank?.question_count ?? src.question_count })
    } else if (next === "random") {
      const pinned = src.pinned_question_ids ?? []
      const count = mode === "full" ? Math.min(10, max) : src.question_count
      onChange({ _mode: "random", question_count: count, _random_ids: doRandomPick(count, pinned) })
    } else {
      setShowPicker(true)
    }
  }

  const handleReroll = () => {
    onChange({ _random_ids: doRandomPick(src.question_count, src.pinned_question_ids ?? []) })
  }

  const handleCountChange = (val: number) => {
    const v = Math.min(max, Math.max(1, val))
    onChange({ question_count: v, _random_ids: doRandomPick(v, src.pinned_question_ids ?? []) })
  }

  const MODES = [
    { key: "full" as SourceMode, icon: BookOpen, label: "Entire Bank", desc: `All ${bank?.question_count ?? "?"} Qs` },
    { key: "random" as SourceMode, icon: Shuffle, label: "Random Pick", desc: "Algorithm picks" },
    { key: "manual" as SourceMode, icon: ListChecks, label: "Manual Pick", desc: "I choose" },
  ]

  return (
    <>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
        <div className="flex items-center gap-3">
          <select className="flex-1 h-9 rounded-[var(--radius)] border border-[var(--input)] bg-transparent px-3 text-sm font-medium" value={src.bank_id}
            onChange={(e) => { const es = examSets.find((s) => s.id === e.target.value); onChange({ bank_id: e.target.value, bank_name: es?.name ?? "", question_count: Math.min(10, es?.question_count ?? 10), pinned_question_ids: [], _mode: "full", _random_ids: [] }) }}>
            {examSets.map((es) => <option key={es.id} value={es.id} disabled={usedBankIds.includes(es.id) && es.id !== src.bank_id}>{es.name} ({es.question_count} questions)</option>)}
          </select>
          <Button variant="ghost" size="icon-sm" onClick={onRemove} className="text-[color:var(--color-danger-500)] shrink-0"><X className="h-4 w-4" /></Button>
        </div>
        {/* Mode tabs */}
        <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-[var(--secondary)] p-1">
          {MODES.map(({ key, icon: Icon, label, desc }) => (
            <button key={key} onClick={() => handleModeChange(key)} className={cn("flex flex-col items-center gap-0.5 rounded-md px-2 py-2 text-center transition-all", mode === key ? "bg-[var(--background)] shadow-sm text-[var(--foreground)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]")}>
              <Icon className={cn("h-3.5 w-3.5", mode === key && "text-[var(--primary)]")} />
              <span className="text-[11px] font-semibold leading-tight">{label}</span>
              <span className="text-[9px] leading-tight opacity-70">{desc}</span>
            </button>
          ))}
        </div>
        {/* Random mode body */}
        {mode === "random" && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Label className="text-xs shrink-0 text-[var(--muted-foreground)]">Pick</Label>
              <Input type="number" min={1} max={max} className="h-8 text-sm w-20" value={src.question_count} onChange={(e) => handleCountChange(Number(e.target.value))} />
              <span className="text-xs text-[var(--muted-foreground)]">of {bank?.question_count ?? "?"}</span>
              {src.question_count > max && <span className="text-xs text-red-500 font-medium">Exceeds bank size!</span>}
              <div className="flex-1" />
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleReroll} disabled={qLoading || allQuestions.length === 0}>
                <RefreshCw className="h-3 w-3" /> Pick Again
              </Button>
            </div>
            {qLoading
              ? <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]"><Loader2 className="h-3 w-3 animate-spin" />Fetching questions…</div>
              : src._random_ids.length > 0
                ? <InlineQuestionList questions={allQuestions} ids={src._random_ids} label="Randomly selected questions" accent="orange" />
                : <p className="text-xs text-[var(--muted-foreground)] italic">Click Pick Again to fetch a lot</p>
            }
          </div>
        )}
        {/* Manual mode body */}
        {mode === "manual" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">{(src.pinned_question_ids?.length ?? 0) > 0 ? `${src.pinned_question_ids!.length} questions selected` : "No questions selected yet"}</span>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowPicker(true)}>
                <ListChecks className="h-3 w-3" />{(src.pinned_question_ids?.length ?? 0) > 0 ? "Edit selection" : "Choose questions"}
              </Button>
            </div>
            {(src.pinned_question_ids?.length ?? 0) > 0 && <InlineQuestionList questions={allQuestions} ids={src.pinned_question_ids!} label="Manually selected questions" accent="primary" />}
          </div>
        )}
        {/* Full mode body */}
        {mode === "full" && bank && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2">
            <BookOpen className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            <span className="text-xs text-[var(--muted-foreground)]">All <span className="font-semibold text-[var(--foreground)]">{bank.question_count}</span> questions from this bank will be included</span>
          </div>
        )}
      </div>
      {showPicker && bank && (
        <QuestionPickerModal
          bank={bank} questions={allQuestions} selected={src.pinned_question_ids ?? []} excludedIds={src._random_ids}
          onConfirm={(ids) => { onChange({ _mode: "manual", pinned_question_ids: ids, question_count: ids.length }); setShowPicker(false) }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}

function SourcesEditor({ sources, onChange, examSets }: { sources: ExamSource[]; onChange: (s: ExamSource[]) => void; examSets: ExamSet[] }) {
  const hydrate = useCallback((srcs: ExamSource[]) =>
    srcs.map((s) => toLocalSource(s, examSets.find((es) => es.id === s.bank_id)?.question_count))
  , [examSets])
  const [localSources, setLocalSources] = useState<LocalSource[]>(() => hydrate(sources))
  const updateLocal = (next: LocalSource[]) => { setLocalSources(next); onChange(next.map(toExamSource)) }
  const sourcesKey = sources.map((s) => s.bank_id).join(",")
  const setsReady = examSets.length > 0
  useEffect(() => { if (sources.length > 0 && setsReady) setLocalSources(hydrate(sources)) }, [sourcesKey, setsReady]) // eslint-disable-line react-hooks/exhaustive-deps
  const usedBankIds = localSources.map((s) => s.bank_id)
  const totalQ = localSources.reduce((a, s) => a + s.question_count, 0)
  const addBank = () => { const unused = examSets.find((es) => !usedBankIds.includes(es.id)); if (!unused) return; updateLocal([...localSources, toLocalSource({ bank_id: unused.id, bank_name: unused.name, question_count: Math.min(10, unused.question_count) }, unused.question_count)]) }
  const update = (i: number, patch: Partial<LocalSource>) => updateLocal(localSources.map((s, idx) => idx !== i ? s : { ...s, ...patch }))
  const remove = (i: number) => updateLocal(localSources.filter((_, idx) => idx !== i))
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div><p className="text-sm font-semibold">Question Bank Sources</p><p className="text-xs text-[var(--muted-foreground)] mt-0.5">Define which banks contribute questions and how they're selected</p></div>
        {totalQ > 0 && <div className="text-right"><p className="text-lg font-bold text-[var(--primary)] leading-none">{totalQ}</p><p className="text-[10px] text-[var(--muted-foreground)]">total questions</p></div>}
      </div>
      <div className="space-y-2">
        {localSources.map((src, i) => <BankSourceRow key={`${src.bank_id}-${i}`} src={src} bank={examSets.find((es) => es.id === src.bank_id)} examSets={examSets} usedBankIds={usedBankIds} onChange={(patch) => update(i, patch)} onRemove={() => remove(i)} />)}
      </div>
      <Button variant="outline" size="sm" className="w-full border-dashed" onClick={addBank} disabled={localSources.length >= examSets.length}>
        <PlusCircle className="h-3.5 w-3.5" /> Add Question Bank
      </Button>
    </div>
  )
}

// ─── Edit Page ────────────────────────────────────────────────────────────────

export default function ExamEditPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [form, setForm] = useState<Partial<CreateExamInput>>({})
  const [saved, setSaved] = useState(false)
  const set = useCallback(<K extends keyof CreateExamInput>(k: K, v: CreateExamInput[K]) => setForm((f) => ({ ...f, [k]: v })), [])

  const { data: exam, isLoading } = useQuery({ queryKey: ["exam", id], queryFn: () => examQueries.get(id) })
  const { data: examSets = [] } = useQuery({ queryKey: ["exam-sets"], queryFn: examQueries.examSets })

  useEffect(() => {
    if (exam) setForm({
      title: exam.title, description: exam.description, exam_type: exam.exam_type,
      duration_minutes: exam.duration_minutes, pass_mark_pct: exam.pass_mark_pct,
      marks_per_question: exam.marks_per_question ?? 1,
      negative_marking: exam.negative_marking ?? false,
      negative_penalty: exam.negative_penalty ?? 0.25,
      shuffle: exam.shuffle, status: exam.status as CreateExamInput["status"], sources: exam.sources ?? [],
    })
  }, [exam])

  const updateMutation = useMutation({
    mutationFn: () => examQueries.update(id, form),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2500); qc.invalidateQueries({ queryKey: ["exam", id] }) },
  })

  if (isLoading) return <div className="space-y-4 max-w-2xl"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>
  if (!exam) return <p className="text-sm text-[var(--muted-foreground)]">Exam not found.</p>

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/exams"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <PageHeader title={exam.title} description="Edit exam details" action={<StatusBadge status={exam.status} />} className="mb-0 flex-1" />
      </div>

      {/* Details card */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Exam Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Exam Type</Label>
              <select className="flex h-10 w-full rounded-[var(--radius)] border border-[var(--input)] bg-transparent px-3 text-sm" value={form.exam_type ?? "mock"} onChange={(e) => set("exam_type", e.target.value as CreateExamInput["exam_type"])}>
                {EXAM_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select className="flex h-10 w-full rounded-[var(--radius)] border border-[var(--input)] bg-transparent px-3 text-sm" value={form.status ?? "draft"} onChange={(e) => set("status", e.target.value as CreateExamInput["status"])}>
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Duration (minutes)</Label>
              <Input type="number" min={1} value={form.duration_minutes ?? 60} onChange={(e) => set("duration_minutes", Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Pass Mark %</Label>
              <Input type="number" min={1} max={100} value={form.pass_mark_pct ?? 40} onChange={(e) => set("pass_mark_pct", Number(e.target.value))} />
            </div>
          </div>

          {/* Marking scheme */}
          <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
            <p className="text-sm font-semibold">Marking Scheme</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Marks per Correct Answer</Label>
                <input type="number" min={0.25} step={0.25} value={form.marks_per_question ?? 1} onChange={(e) => set("marks_per_question", Number(e.target.value))} className="flex h-10 w-full rounded-[var(--radius)] border border-[var(--input)] bg-transparent px-3 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className={cn(!form.negative_marking && "text-[var(--muted-foreground)]")}>Negative Penalty per Wrong</Label>
                <input type="number" min={0} step={0.25} value={form.negative_penalty ?? 0.25} disabled={!form.negative_marking} onChange={(e) => set("negative_penalty", Number(e.target.value))} className="flex h-10 w-full rounded-[var(--radius)] border border-[var(--input)] bg-transparent px-3 text-sm disabled:opacity-50" />
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
                form.negative_marking ? "bg-red-100" : "bg-[var(--secondary)]")}>
                <span className={cn("text-base font-bold leading-none", form.negative_marking ? "text-red-600" : "text-[var(--muted-foreground)]")}>−</span>
              </div>
              <div className="flex-1">
                <p className={cn("text-sm font-semibold", form.negative_marking ? "text-red-700" : "text-[var(--foreground)]")}>Negative Marking</p>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {form.negative_marking ? `−${form.negative_penalty ?? 0.25} marks deducted per wrong answer` : "No penalty for wrong answers"}
                </p>
              </div>
              <div className={cn("h-5 w-9 rounded-full transition-colors relative shrink-0",
                form.negative_marking ? "bg-red-500" : "bg-[var(--border)]")}>
                <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                  form.negative_marking ? "left-[calc(100%-18px)]" : "left-0.5")} />
              </div>
            </button>
          </div>
          {/* Shuffle toggle */}
          <button type="button" onClick={() => set("shuffle", !form.shuffle)} className={cn("w-full flex items-center gap-4 rounded-xl border-2 px-4 py-3 text-left transition-colors", form.shuffle ? "border-[var(--primary)]/40 bg-[var(--primary)]/5" : "border-[var(--border)] hover:border-[var(--primary)]/25")}>
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-full shrink-0", form.shuffle ? "bg-[var(--primary)]/15" : "bg-[var(--secondary)]")}>
              <Shuffle className={cn("h-4 w-4", form.shuffle ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]")} />
            </div>
            <div className="flex-1">
              <p className={cn("text-sm font-semibold", form.shuffle ? "text-[var(--primary)]" : "text-[var(--foreground)]")}>Shuffle Questions</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Questions from all banks are intermixed randomly per attempt</p>
            </div>
            <div className={cn("h-5 w-9 rounded-full transition-colors relative shrink-0", form.shuffle ? "bg-[var(--primary)]" : "bg-[var(--border)]")}>              <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", form.shuffle ? "left-[calc(100%-18px)]" : "left-0.5")} />
            </div>
          </button>
        </CardContent>
      </Card>

      {/* Sources card */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Question Banks</CardTitle></CardHeader>
        <CardContent>
          <SourcesEditor sources={form.sources ?? []} onChange={(sources) => set("sources", sources)} examSets={examSets} />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3 pb-8">
        <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "Saved!" : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}
