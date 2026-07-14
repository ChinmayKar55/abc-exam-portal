"use client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import {
  Plus, Save, Trash2, PlusCircle, Upload, ChevronRight, ChevronDown,
  Search, Pencil, Send, CheckCircle2, Loader2, X, FileText,
} from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/DataTable"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { examQueries, type ExamSet, type Question } from "@/lib/queries/exams"
import { questionQueries, type ParsedQuestion } from "@/lib/queries/questions"
import { cn } from "@/lib/utils"

// ─── Constants ───────────────────────────────────────────────────────────────
const OPTION_LABELS = ["A", "B", "C", "D"] as const
const OPTION_KEYS = ["option_a", "option_b", "option_c", "option_d"] as const
const DIFFICULTIES = ["easy", "medium", "hard"] as const

const BLANK_Q = {
  question_text: "", option_a: "", option_b: "", option_c: "", option_d: "",
  correct_option: "A", explanation: "", difficulty: "medium",
}

// ─── Inline Add-Question form ─────────────────────────────────────────────────
function AddQuestionForm({ bankId, onDone }: { bankId: string; onDone: () => void }) {
  const [q, setQ] = useState({ ...BLANK_Q })
  const set = (k: keyof typeof q, v: string) => setQ((p) => ({ ...p, [k]: v }))
  const valid = q.question_text.trim() && q.option_a.trim() && q.option_b.trim() && q.option_c.trim() && q.option_d.trim()

  const mutation = useMutation({
    mutationFn: () => examQueries.createQuestion({ exam_set_id: bankId, ...q }),
    onSuccess: () => { setQ({ ...BLANK_Q }); onDone() },
  })

  return (
    <div className="rounded-xl border border-[var(--primary)]/30 bg-[color:var(--color-brand-50)]/40 p-5 space-y-4">
      <p className="text-xs font-semibold text-[var(--primary)] uppercase tracking-widest">New Question</p>
      <div className="space-y-1.5">
        <Label className="text-xs">Question Text</Label>
        <Input placeholder="Type the question…" value={q.question_text} onChange={(e) => set("question_text", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {OPTION_KEYS.map((k, i) => (
          <div key={k} className="space-y-1">
            <Label className="text-xs">Option {OPTION_LABELS[i]}</Label>
            <Input placeholder={`Option ${OPTION_LABELS[i]}`} value={q[k]} onChange={(e) => set(k, e.target.value)} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Correct Answer</Label>
          <select className="flex h-9 w-full rounded-[var(--radius)] border border-[var(--input)] bg-[var(--card)] px-3 text-sm" value={q.correct_option} onChange={(e) => set("correct_option", e.target.value)}>
            {OPTION_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Difficulty</Label>
          <select className="flex h-9 w-full rounded-[var(--radius)] border border-[var(--input)] bg-[var(--card)] px-3 text-sm capitalize" value={q.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
            {DIFFICULTIES.map((d) => <option key={d} value={d} className="capitalize">{d}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Explanation</Label>
          <Input placeholder="Optional…" value={q.explanation} onChange={(e) => set("explanation", e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={mutation.isPending || !valid} onClick={() => mutation.mutate()}>
          {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlusCircle className="h-3.5 w-3.5" />}
          {mutation.isPending ? "Saving…" : "Add Question"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  )
}

// ─── Edit-Question dialog ─────────────────────────────────────────────────────
function EditQuestionDialog({ question, onClose, onSaved }: { question: Question; onClose: () => void; onSaved: () => void }) {
  const [q, setQ] = useState({ ...question })
  const set = (k: keyof Question, v: string) => setQ((p) => ({ ...p, [k]: v }))

  const mutation = useMutation({
    mutationFn: () => examQueries.updateQuestion(question.id, q),
    onSuccess: () => { onSaved(); onClose() },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit Question</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Question</Label><Input value={q.question_text} onChange={(e) => set("question_text", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            {OPTION_KEYS.map((k, i) => (
              <div key={k} className="space-y-1.5">
                <Label>Option {OPTION_LABELS[i]}</Label>
                <Input value={(q as unknown as Record<string, string>)[k]} onChange={(e) => set(k as keyof Question, e.target.value)} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Correct Answer</Label>
              <select className="flex h-10 w-full rounded-[var(--radius)] border border-[var(--input)] bg-transparent px-3 text-sm" value={q.correct_option?.toUpperCase()} onChange={(e) => set("correct_option", e.target.value)}>
                {OPTION_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <select className="flex h-10 w-full rounded-[var(--radius)] border border-[var(--input)] bg-transparent px-3 text-sm" value={q.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
                {DIFFICULTIES.map((d) => <option key={d} value={d} className="capitalize">{d}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Explanation</Label><Input value={q.explanation} onChange={(e) => set("explanation", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Bulk Upload Sheet (bank-scoped) ─────────────────────────────────────────
function BulkUploadSheet({ bank, onClose }: { bank: ExamSet; onClose: () => void }) {
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<ParsedQuestion[]>([])
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editQ, setEditQ] = useState<ParsedQuestion>({ question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "", explanation: "" })
  const [dragging, setDragging] = useState(false)

  const publishMutation = useMutation({
    mutationFn: () => questionQueries.publish(uploadId!, bank.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-set-questions", bank.id] })
      qc.invalidateQueries({ queryKey: ["exam-sets"] })
      onClose()
    },
  })

  const handleFile = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const upload = await questionQueries.upload(file)
      if (upload?.id) {
        const preview = await questionQueries.preview(upload.id)
        if (preview) { setUploadId(upload.id); setQuestions(preview.questions) }
      }
    } finally { setUploading(false) }
  }, [])

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }

  const saveEdit = async () => {
    if (editIdx === null || !uploadId) return
    const updated = await questionQueries.updateParsed(uploadId, editIdx, editQ)
    if (updated) setQuestions((qs) => qs.map((q, i) => i === editIdx ? updated : q))
    setEditIdx(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-2xl bg-[var(--card)] border-l border-[var(--border)] flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div>
            <p className="font-semibold text-sm">Bulk Upload Questions</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Bank: <span className="font-medium text-[var(--foreground)]">{bank.name}</span></p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!uploadId ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer",
                dragging ? "border-[var(--primary)] bg-[color:var(--color-brand-50)]" : "border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--secondary)]"
              )}
            >
              {uploading ? (
                <><Loader2 className="h-10 w-10 animate-spin text-[var(--primary)]" /><p className="text-sm font-medium text-[var(--muted-foreground)]">Uploading & parsing…</p></>
              ) : (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--color-brand-50)]">
                    <Upload className="h-7 w-7 text-[var(--primary)]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Drag & drop your file here</p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">Supports .docx and .pdf — MCQs will be auto-extracted</p>
                  </div>
                  <label className="cursor-pointer">
                    <input type="file" accept=".docx,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                    <Button variant="outline" size="sm" asChild><span>Browse files</span></Button>
                  </label>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{questions.length} questions parsed</p>
                <Button variant="ghost" size="sm" onClick={() => { setUploadId(null); setQuestions([]) }}>
                  <X className="h-3.5 w-3.5" /> Start over
                </Button>
              </div>
              <div className="space-y-2">
                {questions.map((q, idx) => (
                  <div key={idx} className="rounded-[var(--radius)] border border-[var(--border)] p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium flex-1 leading-relaxed">{idx + 1}. {q.question_text}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="success" className="font-mono text-xs">{q.correct_option.toUpperCase()}</Badge>
                        <Button variant="ghost" size="icon-sm" onClick={() => { setEditIdx(idx); setEditQ(q) }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-3.5 w-3.5 text-[color:var(--color-danger-500)]" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs text-[var(--muted-foreground)]">
                      <span>A. {q.option_a}</span><span>B. {q.option_b}</span>
                      <span>C. {q.option_c}</span><span>D. {q.option_d}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {uploadId && questions.length > 0 && (
          <div className="border-t border-[var(--border)] px-6 py-4 flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--muted-foreground)]">Will add {questions.length} questions to <span className="font-medium text-[var(--foreground)]">{bank.name}</span></p>
            <Button disabled={publishMutation.isPending} onClick={() => publishMutation.mutate()}>
              {publishMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Publish {questions.length} Questions
            </Button>
          </div>
        )}
      </div>

      {/* Edit parsed question dialog */}
      {editIdx !== null && (
        <Dialog open onOpenChange={() => setEditIdx(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Edit Parsed Question</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Question</Label><Input value={editQ.question_text} onChange={(e) => setEditQ((q) => ({ ...q, question_text: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                {OPTION_KEYS.map((k, i) => (
                  <div key={k} className="space-y-1.5"><Label>Option {OPTION_LABELS[i]}</Label><Input value={(editQ as unknown as Record<string, string>)[k]} onChange={(e) => setEditQ((q) => ({ ...q, [k]: e.target.value }))} /></div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Correct Answer</Label>
                  <select className="flex h-10 w-full rounded-[var(--radius)] border border-[var(--input)] bg-transparent px-3 text-sm" value={editQ.correct_option.toUpperCase()} onChange={(e) => setEditQ((q) => ({ ...q, correct_option: e.target.value }))}>
                    {OPTION_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5"><Label>Explanation</Label><Input value={editQ.explanation} onChange={(e) => setEditQ((q) => ({ ...q, explanation: e.target.value }))} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditIdx(null)}>Cancel</Button>
              <Button onClick={saveEdit}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// ─── Bank Detail Panel (expanded row) ────────────────────────────────────────
function BankDetailPanel({ bank }: { bank: ExamSet }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<"list" | "add" | "upload">("list")
  const [search, setSearch] = useState("")
  const [editQ, setEditQ] = useState<Question | null>(null)

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["exam-set-questions", bank.id],
    queryFn: () => examQueries.examSetQuestions(bank.id),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => examQueries.deleteQuestion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-set-questions", bank.id] })
      qc.invalidateQueries({ queryKey: ["exam-sets"] })
    },
  })

  const filtered = questions.filter((q: Question) =>
    q.question_text.toLowerCase().includes(search.toLowerCase())
  )

  const diffCounts = questions.reduce((acc: Record<string, number>, q: Question) => {
    acc[q.difficulty] = (acc[q.difficulty] ?? 0) + 1
    return acc
  }, {})

  const handleAdded = () => {
    qc.invalidateQueries({ queryKey: ["exam-set-questions", bank.id] })
    qc.invalidateQueries({ queryKey: ["exam-sets"] })
    setMode("list")
  }

  return (
    <div className="space-y-4 py-2">
      {/* Stats row */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-semibold text-[var(--foreground)]">{questions.length}</span>
          <span className="text-[var(--muted-foreground)]">total questions</span>
        </div>
        {Object.entries(diffCounts).map(([diff, count]) => (
          <Badge key={diff} variant={diff === "hard" ? "destructive" : diff === "medium" ? "warning" : "success"} className="capitalize text-xs">
            {diff}: {count}
          </Badge>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
          <Input
            placeholder="Search questions…"
            className="pl-9 h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          variant={mode === "add" ? "default" : "outline"}
          onClick={() => setMode(mode === "add" ? "list" : "add")}
        >
          <PlusCircle className="h-3.5 w-3.5" />
          {mode === "add" ? "Cancel" : "Add Question"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMode("upload")}>
          <Upload className="h-3.5 w-3.5" /> Bulk Upload
        </Button>
      </div>

      {/* Inline add form */}
      {mode === "add" && <AddQuestionForm bankId={bank.id} onDone={handleAdded} />}

      {/* Bulk upload sheet */}
      {mode === "upload" && <BulkUploadSheet bank={bank} onClose={() => { setMode("list"); handleAdded() }} />}

      {/* Edit dialog */}
      {editQ && (
        <EditQuestionDialog
          question={editQ}
          onClose={() => setEditQ(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["exam-set-questions", bank.id] })
            setEditQ(null)
          }}
        />
      )}

      {/* Questions list */}
      <Separator />
      {isLoading && <p className="text-sm text-[var(--muted-foreground)]">Loading questions…</p>}
      {!isLoading && filtered.length === 0 && (
        <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">
          {questions.length === 0 ? "No questions yet — add one above or bulk upload a file." : "No questions match your search."}
        </p>
      )}
      <div className="space-y-2">
        {filtered.map((q: Question) => (
          <div key={q.id} className="group rounded-lg border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/30 transition-colors">
            <div className="flex items-start gap-3 p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-relaxed">{q.question_text}</p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  {OPTION_KEYS.map((k, i) => {
                    const isCorrect = q.correct_option?.toUpperCase() === OPTION_LABELS[i]
                    return (
                      <p key={k} className={cn("text-xs flex items-center gap-1", isCorrect ? "text-[color:var(--color-success-700)] font-medium" : "text-[var(--muted-foreground)]")}>
                        <span className={cn("font-mono font-bold", isCorrect && "text-[color:var(--color-success-600)]")}>{OPTION_LABELS[i]}.</span>
                        {(q as unknown as Record<string, string>)[k]}
                      </p>
                    )
                  })}
                </div>
                {q.explanation && (
                  <p className="mt-2 text-xs text-[var(--muted-foreground)] italic line-clamp-1">💡 {q.explanation}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Badge variant={q.difficulty === "hard" ? "destructive" : q.difficulty === "medium" ? "warning" : "success"} className="capitalize text-xs">
                  {q.difficulty}
                </Badge>
                <Button variant="ghost" size="icon-sm" onClick={() => setEditQ(q)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => deleteMutation.mutate(q.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-[color:var(--color-danger-500)]" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Bank list columns ────────────────────────────────────────────────────────
const bankColumns = (
  onDelete: (id: string) => void,
  expandedId: string | null,
  onToggle: (id: string) => void,
): ColumnDef<ExamSet>[] => [
  {
    id: "expand",
    header: "",
    cell: ({ row }) => (
      <button onClick={() => onToggle(row.original.id)} className="p-1 rounded hover:bg-[var(--secondary)] transition-colors">
        {expandedId === row.original.id
          ? <ChevronDown className="h-4 w-4 text-[var(--primary)]" />
          : <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)]" />}
      </button>
    ),
  },
  {
    accessorKey: "name",
    header: "Bank Name",
    cell: ({ row }) => (
      <button onClick={() => onToggle(row.original.id)} className="text-left">
        <p className="font-semibold text-sm">{row.original.name}</p>
        {row.original.description && <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{row.original.description}</p>}
      </button>
    ),
  },
  {
    accessorKey: "question_count",
    header: "Questions",
    cell: ({ row }) => (
      <Badge variant="ocean" className="font-mono">{row.original.question_count}</Badge>
    ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); onDelete(row.original.id) }}>
        <Trash2 className="h-4 w-4 text-[color:var(--color-danger-500)]" />
      </Button>
    ),
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function QuestionBanksPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: banks = [], isLoading } = useQuery({
    queryKey: ["exam-sets"],
    queryFn: examQueries.examSets,
  })

  const createMutation = useMutation({
    mutationFn: () => examQueries.createExamSet({ name, description }),
    onSuccess: (bank) => {
      qc.invalidateQueries({ queryKey: ["exam-sets"] })
      setCreateOpen(false)
      setName("")
      setDescription("")
      if (bank?.id) setExpandedId(bank.id)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => examQueries.deleteExamSet(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exam-sets"] }),
  })

  const toggleExpand = (id: string) => setExpandedId((prev) => prev === id ? null : id)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question Banks"
        description={`${banks.length} subject-wise banks · click a bank to manage its questions`}
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New Bank
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-[var(--secondary)] animate-pulse" />)}
        </div>
      ) : banks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-brand-50)]">
            <FileText className="h-8 w-8 text-[var(--primary)]" />
          </div>
          <div>
            <p className="font-semibold">No question banks yet</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">Create your first bank to start adding questions</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Create Bank</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {banks.map((bank: ExamSet) => (
            <div key={bank.id} className={cn(
              "rounded-xl border transition-all",
              expandedId === bank.id
                ? "border-[var(--primary)]/40 bg-[var(--card)] shadow-sm"
                : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/20"
            )}>
              {/* Bank header row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                onClick={() => toggleExpand(bank.id)}
              >
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-colors",
                  expandedId === bank.id ? "bg-[var(--primary)] text-white" : "bg-[color:var(--color-brand-50)] text-[var(--primary)]"
                )}>
                  {expandedId === bank.id
                    ? <ChevronDown className="h-4 w-4" />
                    : <ChevronRight className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{bank.name}</p>
                  {bank.description && <p className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate">{bank.description}</p>}
                </div>
                <Badge variant="ocean" className="font-mono shrink-0">{bank.question_count} Qs</Badge>
                <Button
                  variant="ghost" size="icon-sm"
                  onClick={(e) => { e.stopPropagation(); if (confirm(`Delete bank "${bank.name}"? This cannot be undone.`)) deleteMutation.mutate(bank.id) }}
                >
                  <Trash2 className="h-4 w-4 text-[color:var(--color-danger-500)]" />
                </Button>
              </div>

              {/* Expanded detail */}
              {expandedId === bank.id && (
                <div className="border-t border-[var(--border)] px-4 pb-4 pt-3">
                  <BankDetailPanel bank={bank} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create bank dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Question Bank</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Bank Name</Label>
              <Input placeholder="e.g. Odisha GK, Maths, English…" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-[var(--muted-foreground)] font-normal">(optional)</span></Label>
              <Input placeholder="Brief description of this bank" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={!name.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create Bank
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
