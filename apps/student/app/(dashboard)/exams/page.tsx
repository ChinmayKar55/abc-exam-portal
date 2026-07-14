"use client"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import Link from "next/link"
import { BookOpen, Clock, Target, Search, Lock, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/EmptyState"
import { PageHeader } from "@/components/shared/PageHeader"
import { examQueries } from "@/lib/queries/exams"
import { planQueries } from "@/lib/queries/plans"

const TYPE_FILTERS = ["all", "mock", "practice", "paid"] as const

export default function ExamsPage() {
  const [filter, setFilter] = useState<string>("all")
  const [search, setSearch] = useState("")

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["exams", filter],
    queryFn: () => examQueries.list(filter === "all" ? undefined : filter),
  })

  const { data: myPlan } = useQuery({
    queryKey: ["my-plan"],
    queryFn: planQueries.myPlan,
  })

  const planExamIds = new Set(myPlan?.exams?.map((e) => e.id) ?? [])

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
            const hasAccess = planExamIds.has(exam.id)
            return (
              <Card key={exam.id} className="flex flex-col hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex-1 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-tight">{exam.title}</h3>
                    <Badge variant="brand" className="shrink-0 capitalize">{exam.exam_type}</Badge>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] line-clamp-2">{exam.description}</p>
                  <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
                    <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{exam.total_questions} questions</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{exam.duration_minutes} min</span>
                    <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" />Pass: {exam.pass_mark_pct}%</span>
                  </div>
                  {!hasAccess && (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] pt-1">
                      <Lock className="h-3.5 w-3.5" /> Locked — purchase a plan to access
                    </div>
                  )}
                  {hasAccess && (
                    <div className="flex items-center gap-1.5 text-xs text-[color:var(--color-success-700)] pt-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Included in your plan
                    </div>
                  )}
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
