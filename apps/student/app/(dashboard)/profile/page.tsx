"use client"
import { useAuthStore } from "@/store/auth"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/shared/PageHeader"
import { planQueries } from "@/lib/queries/plans"
import { resultQueries } from "@/lib/queries/results"
import { formatDate, formatScore } from "@/lib/utils"
import { BookOpen, FileText } from "lucide-react"

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const { data: myPlan } = useQuery({ queryKey: ["my-plan"], queryFn: planQueries.myPlan })
  const { data: results = [] } = useQuery({ queryKey: ["my-results"], queryFn: resultQueries.list })

  const avgScore = results.length > 0 ? results.reduce((s, r) => s + r.score, 0) / results.length : null
  const passCount = results.filter((r) => r.passed).length

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Profile" description="Your account details and statistics" />

      <Card>
        <CardContent className="p-6 flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full gradient-brand text-white text-2xl font-bold shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold">{user?.name}</h2>
            <p className="text-sm text-[var(--muted-foreground)]">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="brand" className="capitalize">{user?.role}</Badge>
              {user?.emailVerified && <Badge variant="success">Verified</Badge>}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-[var(--muted-foreground)]">Attempts</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{results.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-[var(--muted-foreground)]">Passed</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-[color:var(--color-success-500)]">{passCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-[var(--muted-foreground)]">Avg Score</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-gradient">{avgScore != null ? formatScore(avgScore) : "—"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-[var(--muted-foreground)]">Active Plan</CardTitle></CardHeader>
          <CardContent>
            {myPlan?.active ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold">{myPlan.plan_name}</p>
                {myPlan.expires_at && <p className="text-xs text-[var(--muted-foreground)]">Expires {formatDate(myPlan.expires_at)}</p>}
                {myPlan.exams && myPlan.exams.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-[var(--muted-foreground)]">Exams</p>
                    <ul className="space-y-1">
                      {myPlan.exams.map((e) => (
                        <li key={e.id} className="flex items-center gap-1.5 text-sm">
                          <BookOpen className="h-3.5 w-3.5 text-[var(--primary)]" /> {e.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {myPlan.materials && myPlan.materials.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-[var(--muted-foreground)]">Materials</p>
                    <ul className="space-y-1">
                      {myPlan.materials.map((m) => (
                        <li key={m.id} className="flex items-center gap-1.5 text-sm">
                          <FileText className="h-3.5 w-3.5 text-[var(--primary)]" /> {m.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">No active plan</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
