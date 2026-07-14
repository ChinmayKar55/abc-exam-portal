import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Status =
  | "graded" | "timed_out" | "in_progress"
  | "published" | "draft" | "active" | "archived"
  | "parsed" | "pending" | "failed"
  | "passed" | "failed_exam"

const statusConfig: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "ocean" | "brand" | "secondary" | "outline" }> = {
  graded:      { label: "Graded",      variant: "success" },
  timed_out:   { label: "Timed Out",   variant: "warning" },
  in_progress: { label: "In Progress", variant: "ocean" },
  published:   { label: "Published",   variant: "success" },
  active:      { label: "Active",      variant: "success" },
  draft:       { label: "Draft",       variant: "secondary" },
  archived:    { label: "Archived",    variant: "outline" },
  parsed:      { label: "Parsed",      variant: "brand" },
  pending:     { label: "Pending",     variant: "secondary" },
  failed:      { label: "Failed",      variant: "destructive" },
  passed:      { label: "Passed",      variant: "success" },
  failed_exam: { label: "Failed",      variant: "destructive" },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = statusConfig[status] ?? { label: status, variant: "outline" as const }
  return (
    <Badge variant={cfg.variant} className={cn("capitalize", className)}>
      {cfg.label}
    </Badge>
  )
}
