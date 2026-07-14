"use client"
import { useState } from "react"
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Pencil, Send, Trash2 } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { UploadDropzone } from "@/components/questions/UploadDropzone"
import { DataTable } from "@/components/shared/DataTable"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { questionQueries, type ParsedQuestion, type Upload } from "@/lib/queries/questions"
import { examQueries, type ExamSet } from "@/lib/queries/exams"
import { formatDateTime } from "@/lib/utils"

const uploadCols = (onReview: (id: string) => void): ColumnDef<Upload>[] => [
  { accessorKey: "filename", header: "File", cell: ({ row }) => <span className="text-sm font-medium">{row.original.filename}</span> },
  { accessorKey: "parse_status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.parse_status} /> },
  { accessorKey: "questions_extracted", header: "Extracted", cell: ({ row }) => <Badge variant="ocean">{row.original.questions_extracted}</Badge> },
  { accessorKey: "questions_published", header: "Published", cell: ({ row }) => <Badge variant="success">{row.original.questions_published}</Badge> },
  { accessorKey: "uploaded_at", header: "Uploaded", cell: ({ row }) => <span className="text-xs text-[var(--muted-foreground)]">{formatDateTime(row.original.uploaded_at)}</span> },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      row.original.parse_status === "parsed" && row.original.questions_published === 0 ? (
        <Button size="sm" onClick={() => onReview(row.original.id)}>
          <Pencil className="h-3.5 w-3.5" /> Review & Publish
        </Button>
      ) : row.original.parse_status === "published" ? (
        <span className="flex items-center gap-1 text-xs text-[color:var(--color-success-700)]">
          <CheckCircle2 className="h-3.5 w-3.5" /> Published
        </span>
      ) : null
    ),
  },
]

const DEFAULT_QUESTION: ParsedQuestion = {
  question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "", explanation: "",
}

export default function UploadPage() {
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [reviewUploadId, setReviewUploadId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<ParsedQuestion[]>([])
  const [examSetId, setExamSetId] = useState("")
  const [newSetName, setNewSetName] = useState("")
  const [newSetOpen, setNewSetOpen] = useState(false)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editQ, setEditQ] = useState<ParsedQuestion>(DEFAULT_QUESTION)

  const { data: uploads = [], isLoading } = useQuery({
    queryKey: ["uploads"],
    queryFn: questionQueries.uploads,
  })

  const { data: examSets = [] } = useQuery({
    queryKey: ["exam-sets"],
    queryFn: examQueries.examSets,
  })

  const createSetMutation = useMutation({
    mutationFn: () => examQueries.createExamSet({ name: newSetName, description: "" }),
    onSuccess: (es) => {
      if (es) setExamSetId(es.id)
      qc.invalidateQueries({ queryKey: ["exam-sets"] })
      setNewSetOpen(false)
      setNewSetName("")
    },
  })

  const publishMutation = useMutation({
    mutationFn: (uploadId: string) => questionQueries.publish(uploadId, examSetId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["uploads"] })
      qc.invalidateQueries({ queryKey: ["questions"] })
      qc.invalidateQueries({ queryKey: ["exam-sets"] })
      setReviewUploadId(null)
      setQuestions([])
      setExamSetId("")
    },
  })

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const upload = await questionQueries.upload(file)
      if (upload?.id) {
        await startReview(upload.id)
      }
      qc.invalidateQueries({ queryKey: ["uploads"] })
    } finally {
      setUploading(false)
    }
  }

  const startReview = async (uploadId: string) => {
    const preview = await questionQueries.preview(uploadId)
    if (preview) {
      setReviewUploadId(uploadId)
      setQuestions(preview.questions)
    }
  }

  const saveEdit = async () => {
    if (editIdx === null || !reviewUploadId) return
    const updated = await questionQueries.updateParsed(reviewUploadId, editIdx, editQ)
    if (updated) {
      setQuestions((qs) => qs.map((q, i) => (i === editIdx ? updated : q)))
    }
    setEditIdx(null)
    setEditQ(DEFAULT_QUESTION)
  }

  const removeQuestion = (idx: number) => {
    setQuestions((qs) => qs.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/questions"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <PageHeader title="Upload Questions" description="Upload a DOCX or PDF file to extract MCQs" className="mb-0 flex-1" />
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Upload File</CardTitle></CardHeader>
        <CardContent>
          <UploadDropzone onUpload={handleUpload} isLoading={uploading} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Upload History</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            columns={uploadCols(startReview)}
            data={uploads}
            isLoading={isLoading}
            pageSize={10}
          />
        </CardContent>
      </Card>

      {reviewUploadId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Review Parsed Questions ({questions.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Assign to Exam Set</Label>
                <select
                  className="mt-1.5 flex h-10 w-full rounded-[var(--radius)] border border-[var(--input)] bg-transparent px-3 text-sm"
                  value={examSetId}
                  onChange={(e) => setExamSetId(e.target.value)}
                >
                  <option value="">Select exam set</option>
                  {examSets.map((es: ExamSet) => <option key={es.id} value={es.id}>{es.name}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={() => setNewSetOpen(true)}>+ New Exam Set</Button>
              </div>
            </div>

            <div className="space-y-2">
              {questions.map((q, idx) => (
                <div key={idx} className="rounded-[var(--radius)] border border-[var(--border)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium flex-1">{idx + 1}. {q.question_text}</p>
                    <div className="flex items-center gap-1">
                      <Badge variant="success" className="font-mono">{q.correct_option.toUpperCase()}</Badge>
                      <Button variant="ghost" size="icon-sm" onClick={() => { setEditIdx(idx); setEditQ(q) }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => removeQuestion(idx)}>
                        <Trash2 className="h-3.5 w-3.5 text-[color:var(--color-danger-500)]" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[var(--muted-foreground)]">
                    <span>A. {q.option_a}</span>
                    <span>B. {q.option_b}</span>
                    <span>C. {q.option_c}</span>
                    <span>D. {q.option_d}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setReviewUploadId(null)}>Cancel</Button>
              <Button
                disabled={!examSetId || questions.length === 0 || publishMutation.isPending}
                onClick={() => reviewUploadId && publishMutation.mutate(reviewUploadId)}
              >
                <Send className="h-3.5 w-3.5" /> Publish {questions.length} Questions
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={newSetOpen} onOpenChange={setNewSetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create New Exam Set</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={newSetName} onChange={(e) => setNewSetName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSetOpen(false)}>Cancel</Button>
            <Button disabled={!newSetName.trim() || createSetMutation.isPending} onClick={() => createSetMutation.mutate()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editIdx !== null} onOpenChange={() => setEditIdx(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Question</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Question</Label><Input value={editQ.question_text} onChange={(e) => setEditQ((q) => ({ ...q, question_text: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Option A</Label><Input value={editQ.option_a} onChange={(e) => setEditQ((q) => ({ ...q, option_a: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Option B</Label><Input value={editQ.option_b} onChange={(e) => setEditQ((q) => ({ ...q, option_b: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Option C</Label><Input value={editQ.option_c} onChange={(e) => setEditQ((q) => ({ ...q, option_c: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Option D</Label><Input value={editQ.option_d} onChange={(e) => setEditQ((q) => ({ ...q, option_d: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Correct Option</Label>
                <select
                  className="flex h-10 w-full rounded-[var(--radius)] border border-[var(--input)] bg-transparent px-3 text-sm"
                  value={editQ.correct_option.toUpperCase()}
                  onChange={(e) => setEditQ((q) => ({ ...q, correct_option: e.target.value }))}
                >
                  {["A", "B", "C", "D"].map((o) => <option key={o} value={o}>{o}</option>)}
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
    </div>
  )
}
