"use client"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import Link from "next/link"
import { BookOpen, Clock, Target, Search, Lock, CheckCircle2, Crown, Zap } from "lucide-react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/EmptyState"
import { PageHeader } from "@/components/shared/PageHeader"
import { examQueries } from "@/lib/queries/exams"
import { subscriptionQueries } from "@/lib/queries/subscription"
import { useAuthReady } from "@/lib/providers"

const TYPE_FILTERS = ["all", "mock", "practice"] as const

const tierLabels: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  max: "Max",
}

const tierIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  free: CheckCircle2,
  pro: Zap,
  max: Crown,
}

const tierColors: Record<string, string> = {
  free: "bg-slate-100 text-slate-700",
  pro: "bg-amber-100 text-amber-700",
  max: "bg-violet-100 text-violet-700",
}

export default function ExamsPage() {
  const [filter, setFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const isAuthReady = useAuthReady()

  const { data, isLoading } = useQuery({
    queryKey: ["exams", filter],
    queryFn: () => examQueries.list(filter === "all" ? undefined : filter),
  })

  const { data: mySub } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: subscriptionQueries.mySubscription,
    enabled: isAuthReady,
  })

  const planTier = mySub?.tier ?? "free"
  const exams = data ?? []

  const getAccessMeta = (hasAccess: boolean, tier: string) => {
    if (hasAccess) {
      if (tier === "free") return { text: "Free", variant: "success" }
      if (planTier === "max") return { text: "Max plan", variant: "success" }
      if (planTier === "pro" && tier === "pro") return { text: "Pro plan", variant: "success" }
      return { text: "Unlocked", variant: "success" }
    }
    return { text: `Requires ${tierLabels[tier] ?? "Pro"} plan`, variant: "locked" }
  }

  const filtered = exams.filter((e) =>
    e.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Exams" description="Choose an exam to start practising" />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input placeholder="Search exams…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                filter === t
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--muted)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5 space-y-3"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-1/2" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="No exams found" description="Try adjusting your search or filter." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((exam) => {
            const hasAccess = exam.has_access
            const meta = getAccessMeta(hasAccess, exam.access_tier)
            const TierIcon = tierIcons[exam.access_tier] ?? CheckCircle2
            const AccessIcon = meta.variant === "success" ? CheckCircle2 : Lock
            return (
              <Card key={exam.id} className="flex flex-col hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex-1 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-tight">{exam.title}</h3>
                    <div className="flex gap-1.5 shrink-0">
                      <Badge variant="brand" className="capitalize">{exam.exam_type}</Badge>
                      <Badge className={tierColors[exam.access_tier] ?? tierColors.free}>
                        <TierIcon className="h-3 w-3 mr-1" />
                        {tierLabels[exam.access_tier] ?? tierLabels.free}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] line-clamp-2">{exam.description}</p>
                  <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
                    <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{exam.total_questions} questions</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{exam.duration_minutes} min</span>
                    <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" />Pass: {exam.pass_mark_pct}%</span>
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs pt-1 ${meta.variant === "success" ? "text-[color:var(--color-success-700)]" : "text-[var(--muted-foreground)]"}`}>
                    <AccessIcon className="h-3.5 w-3.5" /> {meta.text}
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <Button asChild className="w-full" size="sm" variant={hasAccess ? "default" : "outline"}>
                    <Link href={`/exams/${exam.id}`}>{hasAccess ? "View Exam" : "Preview"}</Link>
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
