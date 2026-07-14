import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  iconBg?: string
  iconColor?: string
  trend?: string
  isLoading?: boolean
}

export function StatCard({ label, value, icon: Icon, iconBg, iconColor, trend, isLoading }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl shrink-0", iconBg ?? "bg-[color:var(--color-brand-50)]")}>
            <Icon className={cn("h-5 w-5", iconColor ?? "text-[var(--primary)]")} />
          </div>
          {trend && (
            <span className="text-xs font-medium text-[color:var(--color-success-700)] bg-[color:var(--color-success-50)] px-2 py-0.5 rounded-full">
              {trend}
            </span>
          )}
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">{label}</p>
          {isLoading ? (
            <Skeleton className="h-8 w-20 mt-1" />
          ) : (
            <p className="text-3xl font-bold mt-1">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
