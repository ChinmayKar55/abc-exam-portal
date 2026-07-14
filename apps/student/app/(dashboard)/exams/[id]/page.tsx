"use client"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { BookOpen, Clock, Target, ShuffleIcon, Loader2, AlertCircle, Lock, Database } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { examQueries } from "@/lib/queries/exams"
import { planQueries } from "@/lib/queries/plans"
import { useState } from "react"

export default function ExamDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [error, setError] = useState("")

  const { data: exam, isLoading } = useQuery({
    queryKey: ["exam", id],
    queryFn: () => examQueries.get(id),
  })

  const { data: myPlan } = useQuery({
    queryKey: ["my-plan"],
    queryFn: planQueries.myPlan,
  })

  const hasAccess = Boolean(myPlan?.active && myPlan?.exams?.some((e) => e.id === id))

  const startMutation = useMutation({
    mutationFn: () => examQueries.start(id),
    onSuccess: (data) => {
      // Store exam_type alongside StartResponse so attempt page can pick the right UI
      sessionStorage.setItem(`attempt:${data.attempt_id}`, JSON.stringify({ ...data, exam_type: exam?.exam_type ?? "practice" }))
      router.push(`/attempt/${data.attempt_id}`)
    },
    onError: (e: Error) => setError(e.message.includes("403") || e.message.includes("plan") ? "You need an active plan to start this exam." : "Could not start exam. Try again."),
  })

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (!exam) return <p className="text-[var(--muted-foreground)]">Exam not found.</p>

  const info = [
    { icon: BookOpen, label: "Questions", value: exam.total_questions },
    { icon: Clock, label: "Duration", value: `${exam.duration_minutes} min` },
    { icon: Target, label: "Pass Mark", value: `${exam.pass_mark_pct}%` },
    { icon: ShuffleIcon, label: "Shuffled", value: exam.shuffle ? "Yes" : "No" },
  ]

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="brand" className="capitalize">{exam.exam_type}</Badge>
        </div>
        <h1 className="text-2xl font-bold">{exam.title}</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">{exam.description}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-[var(--muted-foreground)]">Exam Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {info.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--color-brand-50)]">
                <Icon className="h-4 w-4 text-[var(--primary)]" />
              </div>
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
                <p className="text-sm font-semibold">{value}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {(exam.sources ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--muted-foreground)] flex items-center gap-2">
              <Database className="h-3.5 w-3.5" /> Question Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {exam.sources.map((src) => (
              <div key={src.bank_id} className="flex items-center justify-between text-sm">
                <span className="text-[var(--foreground)]">{src.bank_name}</span>
                <span className="font-mono font-semibold text-[var(--primary)]">{src.question_count} questions</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Separator />

      <div className="space-y-3 rounded-[var(--radius)] bg-[color:var(--color-warning-50)] border border-[color:var(--color-warning-500)]/20 p-4">
        <p className="text-sm font-medium text-[color:var(--color-warning-700)]">Before you begin</p>
        <ul className="text-sm text-[color:var(--color-warning-700)] space-y-1 list-disc list-inside">
          <li>Ensure a stable internet connection</li>
          <li>The exam will auto-submit when time expires</li>
          <li>You cannot pause once started</li>
        </ul>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-[var(--radius)] bg-[color:var(--color-danger-50)] border border-[color:var(--color-danger-500)]/20 p-3 text-sm text-[color:var(--color-danger-700)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {hasAccess ? (
        <Button
          size="lg"
          className="w-full"
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
        >
          {startMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Start Exam
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-[var(--radius)] bg-[color:var(--color-warning-50)] border border-[color:var(--color-warning-500)]/20 p-3 text-sm text-[color:var(--color-warning-700)]">
            <Lock className="h-4 w-4 shrink-0" />
            This exam is not included in your current plan. Purchase a plan that bundles this exam to start.
          </div>
          <Button size="lg" variant="outline" className="w-full" asChild>
            <a href="/plans">View Plans</a>
          </Button>
        </div>
      )}
    </div>
  )
}
