"use client"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Trophy } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/DataTable"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { EmptyState } from "@/components/shared/EmptyState"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { resultQueries, type Result } from "@/lib/queries/results"
import { formatScore, formatDate } from "@/lib/utils"

const columns: ColumnDef<Result>[] = [
  {
    accessorKey: "exam_title",
    header: "Exam",
    cell: ({ row }) => (
      <Link href={`/results/${row.original.attempt_id}`} className="font-medium hover:text-[var(--primary)] hover:underline">
        {row.original.exam_title}
      </Link>
    ),
  },
  {
    accessorKey: "score",
    header: "Score",
    cell: ({ row }) => <span className="font-mono font-semibold">{formatScore(row.original.score)}</span>,
  },
  {
    accessorKey: "correct_answers",
    header: "Correct",
    cell: ({ row }) => `${row.original.correct_answers} / ${row.original.total_questions}`,
  },
  {
    accessorKey: "passed",
    header: "Result",
    cell: ({ row }) => <StatusBadge status={row.original.passed ? "passed" : "failed_exam"} />,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/results/${row.original.attempt_id}`}>Review</Link>
      </Button>
    ),
  },
]

export default function ResultsPage() {
  const { data: results = [], isLoading } = useQuery({
    queryKey: ["my-results"],
    queryFn: () => resultQueries.list(),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="My Results" description="Review all your past exam attempts" />
      {!isLoading && results.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No results yet"
          description="Complete an exam to see your results here."
          action={<Button asChild><Link href="/exams">Browse Exams</Link></Button>}
        />
      ) : (
        <DataTable
          columns={columns}
          data={results}
          isLoading={isLoading}
          searchKey="exam_title"
          searchPlaceholder="Search results…"
        />
      )}
    </div>
  )
}
