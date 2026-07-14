"use client"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { ShieldAlert, ShieldCheck, AlertTriangle, X } from "lucide-react"
import { DataTable } from "@/components/shared/DataTable"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { PageHeader } from "@/components/shared/PageHeader"
import { adminQueries, type AdminAttempt, type ProctoringViolation } from "@/lib/queries/admin"
import { formatDateTime, formatScore, cn } from "@/lib/utils"

// ─── Violations Detail Modal ──────────────────────────────────────────────────
function ViolationsModal({
  attempt,
  onClose,
}: {
  attempt: AdminAttempt
  onClose: () => void
}) {
  const { data: violations = [], isLoading } = useQuery({
    queryKey: ["violations", attempt.id],
    queryFn: () => adminQueries.violations(attempt.id),
  })

  const SEVERITY_STYLE: Record<string, string> = {
    critical: "bg-[color:var(--color-danger-50)] text-[color:var(--color-danger-700)] border-[color:var(--color-danger-200)]",
    warn: "bg-[color:var(--color-warning-50)] text-[color:var(--color-warning-700)] border-[color:var(--color-warning-200)]",
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-[var(--border)]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {attempt.is_flagged
                ? <ShieldAlert className="h-5 w-5 text-[color:var(--color-danger-500)]" />
                : <ShieldCheck className="h-5 w-5 text-[color:var(--color-success-500)]" />}
              <h2 className="font-semibold text-base">Proctoring Report</h2>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">
              {attempt.user_name} · {attempt.exam_title}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] mt-0.5">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 px-6 py-4 border-b border-[var(--border)]">
          <div className="rounded-lg border border-[var(--border)] p-3 text-center">
            <p className="text-2xl font-bold font-mono">{attempt.violation_count}</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Critical violations</p>
          </div>
          <div className={cn(
            "rounded-lg border p-3 text-center",
            attempt.is_flagged
              ? "border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)]"
              : "border-[color:var(--color-success-200)] bg-[color:var(--color-success-50)]"
          )}>
            <p className={cn(
              "text-sm font-bold",
              attempt.is_flagged ? "text-[color:var(--color-danger-700)]" : "text-[color:var(--color-success-700)]"
            )}>
              {attempt.is_flagged ? "⚠ FLAGGED" : "✓ CLEAN"}
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Attempt status</p>
          </div>
        </div>

        {/* Event log */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {isLoading && (
            <div className="text-center py-8 text-sm text-[var(--muted-foreground)]">Loading events…</div>
          )}
          {!isLoading && violations.length === 0 && (
            <div className="text-center py-8 text-sm text-[var(--muted-foreground)]">No violations recorded.</div>
          )}
          {violations.map((v: ProctoringViolation) => (
            <div key={v.id} className={cn(
              "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm",
              SEVERITY_STYLE[v.severity] ?? "bg-[var(--secondary)] border-[var(--border)]"
            )}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold capitalize">{v.event_type.replace(/_/g, " ")}</span>
                  <span className="text-xs opacity-70 font-mono shrink-0">
                    {new Date(v.occurred_at).toLocaleTimeString()}
                  </span>
                </div>
                <span className="text-xs opacity-70 capitalize">{v.severity}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function AttemptsPage() {
  const [selected, setSelected] = useState<AdminAttempt | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["admin-attempts", 1],
    queryFn: () => adminQueries.attempts(1),
  })

  const columns: ColumnDef<AdminAttempt>[] = [
    {
      accessorKey: "user_name",
      header: "Student",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.user_name}</p>
          <p className="text-xs text-[var(--muted-foreground)]">{row.original.user_email}</p>
        </div>
      ),
    },
    {
      accessorKey: "exam_title",
      header: "Exam",
      cell: ({ row }) => <span className="text-sm">{row.original.exam_title}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "score",
      header: "Score",
      cell: ({ row }) => (
        <span className="font-mono text-sm font-semibold">
          {formatScore(row.original.score ?? null)}
        </span>
      ),
    },
    {
      id: "proctoring",
      header: "Proctoring",
      cell: ({ row }) => {
        const { is_flagged, violation_count } = row.original
        if (violation_count === 0) {
          return (
            <div className="flex items-center gap-1.5 text-xs text-[color:var(--color-success-700)]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Clean
            </div>
          )
        }
        return (
          <button
            onClick={() => setSelected(row.original)}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium rounded-full px-2 py-0.5 border transition-colors hover:opacity-80",
              is_flagged
                ? "bg-[color:var(--color-danger-50)] text-[color:var(--color-danger-700)] border-[color:var(--color-danger-200)]"
                : "bg-[color:var(--color-warning-50)] text-[color:var(--color-warning-700)] border-[color:var(--color-warning-200)]"
            )}
          >
            <ShieldAlert className="h-3 w-3" />
            {is_flagged ? "Flagged" : `${violation_count} warning${violation_count > 1 ? "s" : ""}`}
          </button>
        )
      },
    },
    {
      accessorKey: "started_at",
      header: "Started",
      cell: ({ row }) => (
        <span className="text-xs text-[var(--muted-foreground)]">
          {formatDateTime(row.original.started_at)}
        </span>
      ),
    },
    {
      accessorKey: "submitted_at",
      header: "Submitted",
      cell: ({ row }) => (
        <span className="text-xs text-[var(--muted-foreground)]">
          {row.original.submitted_at ? formatDateTime(row.original.submitted_at) : "—"}
        </span>
      ),
    },
  ]

  const flaggedCount = data?.data?.filter((a) => a.is_flagged).length ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attempts"
        description={
          data?.meta
            ? `${data.meta.total} total attempts${flaggedCount > 0 ? ` · ${flaggedCount} flagged` : ""}`
            : "All exam attempts"
        }
      />
      {flaggedCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] px-4 py-3">
          <ShieldAlert className="h-5 w-5 text-[color:var(--color-danger-500)] shrink-0" />
          <p className="text-sm text-[color:var(--color-danger-700)] font-medium">
            {flaggedCount} attempt{flaggedCount > 1 ? "s" : ""} flagged for proctoring violations. Review them below.
          </p>
        </div>
      )}
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        searchKey="user_name"
        searchPlaceholder="Search by student or exam…"
        pageSize={20}
      />
      {selected && (
        <ViolationsModal attempt={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
