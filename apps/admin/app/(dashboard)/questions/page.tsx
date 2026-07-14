"use client"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Upload } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/DataTable"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { questionQueries, type Question } from "@/lib/queries/questions"
import { cn, formatDate } from "@/lib/utils"

const columns: ColumnDef<Question>[] = [
  {
    accessorKey: "question_text",
    header: "Question",
    cell: ({ row }) => (
      <p className="text-sm max-w-md truncate">{row.original.question_text}</p>
    ),
  },
  {
    accessorKey: "correct_option",
    header: "Answer",
    cell: ({ row }) => (
      <Badge variant="success" className="font-mono">{row.original.correct_option}</Badge>
    ),
  },
  {
    accessorKey: "difficulty",
    header: "Difficulty",
    cell: ({ row }) => {
      const d = row.original.difficulty
      const variant = d === "hard" ? "destructive" : d === "medium" ? "warning" : "success"
      return <Badge variant={variant} className="capitalize">{d || "—"}</Badge>
    },
  },
  {
    accessorKey: "created_at",
    header: "Added",
    cell: ({ row }) => <span className="text-xs text-[var(--muted-foreground)]">{formatDate(row.original.created_at)}</span>,
  },
]

const optionLabels = ["A", "B", "C", "D"] as const
const optionKeys = ["option_a", "option_b", "option_c", "option_d"] as const

function ExpandedQuestion({ question }: { question: Question }) {
  return (
    <Card className="border-l-4 border-l-[var(--primary)]">
      <CardContent className="space-y-4 p-4">
        <div>
          <h4 className="text-sm font-semibold text-[var(--muted-foreground)] mb-1">Full Question</h4>
          <p className="text-base font-medium leading-relaxed">{question.question_text}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {optionLabels.map((label, i) => {
            const isCorrect = question.correct_option?.toUpperCase() === label
            const optionText = question[optionKeys[i]]
            return (
              <div
                key={label}
                className={cn(
                  "flex items-start gap-3 rounded-[var(--radius)] border p-3",
                  isCorrect
                    ? "border-[var(--color-success-500)] bg-[var(--color-success-50)]"
                    : "border-[var(--border)] bg-[var(--card)]"
                )}
              >
                <Badge
                  variant={isCorrect ? "success" : "secondary"}
                  className="mt-0.5 h-6 w-6 shrink-0 items-center justify-center rounded-full p-0 font-mono"
                >
                  {label}
                </Badge>
                <span className={cn("text-sm", isCorrect && "font-medium text-[var(--color-success-700)]")}>
                  {optionText}
                </span>
              </div>
            )
          })}
        </div>

        {question.explanation && (
          <div className="rounded-[var(--radius)] bg-[var(--muted)] p-3">
            <h4 className="text-sm font-semibold text-[var(--muted-foreground)] mb-1">Explanation</h4>
            <p className="text-sm leading-relaxed">{question.explanation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function QuestionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["questions", 1],
    queryFn: () => questionQueries.list(1),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question Bank"
        description={data?.meta ? `${data.meta.total} questions total` : "All MCQ questions"}
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/questions/upload">
                <Upload className="h-4 w-4" /> Upload File
              </Link>
            </Button>
          </div>
        }
      />
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        searchKey="question_text"
        searchPlaceholder="Search questions…"
        pageSize={20}
        expandable
        renderExpandedRow={(question) => <ExpandedQuestion question={question} />}
      />
    </div>
  )
}
