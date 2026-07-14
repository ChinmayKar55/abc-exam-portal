"use client"
import { useQuery } from "@tanstack/react-query"
import { Users, BookOpen, FileText, Activity, DollarSign } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { StatCard } from "@/components/dashboard/StatCard"
import { DataTable } from "@/components/shared/DataTable"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { adminQueries, type AdminAttempt, type AdminUpload } from "@/lib/queries/admin"
import { formatCurrency, formatDateTime } from "@/lib/utils"

const attemptCols: ColumnDef<AdminAttempt>[] = [
  { accessorKey: "user_name",  header: "Student",  cell: ({ row }) => <div><p className="font-medium text-sm">{row.original.user_name}</p><p className="text-xs text-[var(--muted-foreground)]">{row.original.user_email}</p></div> },
  { accessorKey: "exam_title", header: "Exam",     cell: ({ row }) => <span className="text-sm">{row.original.exam_title}</span> },
  { accessorKey: "status",     header: "Status",   cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  { accessorKey: "score",      header: "Score",    cell: ({ row }) => <span className="font-mono text-sm">{row.original.score != null ? `${row.original.score.toFixed(1)}%` : "—"}</span> },
  { accessorKey: "started_at", header: "Started",  cell: ({ row }) => <span className="text-xs text-[var(--muted-foreground)]">{formatDateTime(row.original.started_at)}</span> },
]

const uploadCols: ColumnDef<AdminUpload>[] = [
  { accessorKey: "filename",            header: "File",       cell: ({ row }) => <span className="text-sm font-medium">{row.original.filename}</span> },
  { accessorKey: "parse_status",        header: "Status",     cell: ({ row }) => <StatusBadge status={row.original.parse_status} /> },
  { accessorKey: "questions_extracted", header: "Extracted",  cell: ({ row }) => <span className="font-mono text-sm">{row.original.questions_extracted}</span> },
  { accessorKey: "questions_published", header: "Published",  cell: ({ row }) => <span className="font-mono text-sm">{row.original.questions_published}</span> },
  { accessorKey: "uploaded_at",         header: "Uploaded",   cell: ({ row }) => <span className="text-xs text-[var(--muted-foreground)]">{formatDateTime(row.original.uploaded_at)}</span> },
]

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: adminQueries.stats,
    refetchInterval: 60_000,
  })
  const { data: attemptsData, isLoading: attemptsLoading } = useQuery({
    queryKey: ["admin-attempts", 1],
    queryFn: () => adminQueries.attempts(1),
  })
  const { data: uploadsData, isLoading: uploadsLoading } = useQuery({
    queryKey: ["admin-uploads", 1],
    queryFn: () => adminQueries.uploads(1),
  })

  const statCards = [
    { label: "Total Users",     value: stats?.total_users ?? 0,      icon: Users,     iconBg: "bg-[color:var(--color-brand-50)]",   iconColor: "text-[var(--primary)]" },
    { label: "Total Questions", value: stats?.total_questions ?? 0,   icon: FileText,  iconBg: "bg-[color:var(--color-ocean-50)]",   iconColor: "text-[color:var(--color-ocean-600)]" },
    { label: "Exams",           value: stats?.total_exams ?? 0,       icon: BookOpen,  iconBg: "bg-[color:var(--color-success-50)]", iconColor: "text-[color:var(--color-success-700)]" },
    { label: "Attempts",        value: stats?.total_attempts ?? 0,    icon: Activity,  iconBg: "bg-[color:var(--color-warning-50)]", iconColor: "text-[color:var(--color-warning-700)]" },
    { label: "Revenue",         value: stats ? formatCurrency(stats.revenue_captured_paise) : "—", icon: DollarSign, iconBg: "bg-[color:var(--color-success-50)]", iconColor: "text-[color:var(--color-success-700)]" },
  ]

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="Overview of your exam portal" />

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} isLoading={statsLoading} />
        ))}
      </div>

      {/* Recent attempts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Attempts</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={attemptCols}
            data={attemptsData?.data ?? []}
            isLoading={attemptsLoading}
            pageSize={8}
          />
        </CardContent>
      </Card>

      {/* Question uploads */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Question Uploads</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={uploadCols}
            data={uploadsData?.data ?? []}
            isLoading={uploadsLoading}
            pageSize={5}
          />
        </CardContent>
      </Card>
    </div>
  )
}
