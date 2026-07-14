"use client"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, XCircle, MinusCircle, ArrowLeft, TrendingDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { resultQueries } from "@/lib/queries/results"
import { formatScore, cn } from "@/lib/utils"

export default function ResultDetailPage() {
  const { attemptId } = useParams<{ attemptId: string }>()

  const { data: result, isLoading } = useQuery({
    queryKey: ["result", attemptId],
    queryFn: () => resultQueries.get(attemptId, true),
    staleTime: Infinity,
  })

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (!result) return <p className="text-[var(--muted-foreground)]">Result not found.</p>

  const scoreStats = [
    { label: "Correct",     value: result.correct_answers,  icon: CheckCircle2, color: "text-[color:var(--color-success-500)]" },
    { label: "Wrong",       value: result.wrong_answers,    icon: XCircle,      color: "text-[var(--destructive)]" },
    { label: "Unattempted", value: result.unattempted,      icon: MinusCircle,  color: "text-[var(--muted-foreground)]" },
  ]

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/results"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">{result.exam_title}</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Attempt result</p>
        </div>
      </div>

      {/* Score card */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-bold text-gradient">
                  {result.total_marks > 0
                    ? `${result.raw_score % 1 === 0 ? result.raw_score : result.raw_score.toFixed(2)} / ${result.total_marks % 1 === 0 ? result.total_marks : result.total_marks.toFixed(2)}`
                    : formatScore(result.score)}
                </p>
                {result.total_marks > 0 && (
                  <span className="text-sm text-[var(--muted-foreground)] font-medium">{formatScore(result.score)}</span>
                )}
              </div>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                {result.total_questions} questions · {result.marks_per_question}m each
                {result.negative_marking && ` · −${result.negative_penalty}m per wrong`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={result.passed ? "passed" : "failed_exam"} />
              <StatusBadge status={result.status} />
            </div>
          </div>
          <Progress value={result.score} />
          <div className="grid grid-cols-3 gap-3">
            {scoreStats.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2.5">
                <Icon className={cn("h-4 w-4 shrink-0", color)} />
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
                  <p className="text-lg font-bold">{value}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Marks breakdown */}
          {result.total_marks > 0 && (
            <div className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)] text-sm">
              <div className="flex justify-between px-4 py-2">
                <span className="text-[var(--muted-foreground)]">Marks for correct</span>
                <span className="font-semibold text-[color:var(--color-success-500)]">
                  +{(result.correct_answers * result.marks_per_question).toFixed(2)}
                </span>
              </div>
              {result.negative_marking && (
                <div className="flex justify-between px-4 py-2">
                  <span className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
                    <TrendingDown className="h-3.5 w-3.5" /> Negative marking
                  </span>
                  <span className="font-semibold text-[var(--destructive)]">
                    −{(result.wrong_answers * result.negative_penalty).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between px-4 py-2 bg-[var(--secondary)] rounded-b-lg">
                <span className="font-semibold">Net Score</span>
                <span className="font-bold">
                  {result.raw_score % 1 === 0 ? result.raw_score : result.raw_score.toFixed(2)} / {result.total_marks % 1 === 0 ? result.total_marks : result.total_marks.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review */}
      {result.review && result.review.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Question Review</h2>
          <Accordion type="multiple" className="space-y-2">
            {result.review.map((q) => (
              <AccordionItem
                key={q.position}
                value={String(q.position)}
                className={cn(
                  "rounded-[var(--radius)] border px-4",
                  q.is_correct
                    ? "border-[color:var(--color-success-500)]/30 bg-[color:var(--color-success-50)]"
                    : q.your_answer
                    ? "border-[color:var(--color-danger-500)]/30 bg-[color:var(--color-danger-50)]"
                    : "border-[var(--border)] bg-[color:var(--color-warning-50)]"
                )}
              >
                <AccordionTrigger className="hover:no-underline gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 text-left">
                    {q.is_correct ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--color-success-500)]" />
                    ) : q.your_answer ? (
                      <XCircle className="h-4 w-4 shrink-0 text-[var(--destructive)]" />
                    ) : (
                      <MinusCircle className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                    )}
                    <span className="text-sm font-medium truncate">Q{q.position}. {q.question_text}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pb-2">
                    {[
                      { label: "A", text: q.option_a },
                      { label: "B", text: q.option_b },
                      { label: "C", text: q.option_c },
                      { label: "D", text: q.option_d },
                    ].map(({ label, text }) => (
                      <div
                        key={label}
                        className={cn(
                          "flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm",
                          label === q.correct_option
                            ? "border-[color:var(--color-success-500)] bg-[color:var(--color-success-50)] font-medium"
                            : label === q.your_answer && !q.is_correct
                            ? "border-[color:var(--color-danger-500)] bg-[color:var(--color-danger-50)]"
                            : "border-transparent bg-[var(--secondary)]"
                        )}
                      >
                        <span className="font-bold shrink-0">{label}.</span>
                        <span>{text}</span>
                        {label === q.correct_option && (
                          <Badge variant="success" className="ml-auto shrink-0">Correct</Badge>
                        )}
                        {label === q.your_answer && !q.is_correct && (
                          <Badge variant="destructive" className="ml-auto shrink-0">Your answer</Badge>
                        )}
                      </div>
                    ))}
                    {q.explanation && (
                      <p className="text-xs text-[var(--muted-foreground)] border-t border-[var(--border)] pt-2 mt-2">
                        <span className="font-semibold">Explanation: </span>{q.explanation}
                      </p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      <Button variant="outline" asChild className="w-full">
        <Link href="/exams">Take another exam</Link>
      </Button>
    </div>
  )
}
