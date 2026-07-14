"use client"
import { useQuery } from "@tanstack/react-query"
import { BookOpen, Trophy, Clock, TrendingUp, BarChart3, Medal, Timer } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { PageHeader } from "@/components/shared/PageHeader"
import { LineChart, BarChart } from "@/components/shared/SimpleCharts"
import { useAuthStore } from "@/store/auth"
import { examQueries } from "@/lib/queries/exams"
import { resultQueries } from "@/lib/queries/results"
import { formatScore, formatDateTime } from "@/lib/utils"

const DUMMY_PERFORMANCE = [
  { label: "A1", value: 65 },
  { label: "A2", value: 72 },
  { label: "A3", value: 68 },
  { label: "A4", value: 80 },
  { label: "A5", value: 75 },
  { label: "A6", value: 82 },
  { label: "A7", value: 88 },
]

const DUMMY_ATTEMPTS = [
  { label: "Mon", value: 2 },
  { label: "Tue", value: 1 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 0 },
  { label: "Fri", value: 2 },
  { label: "Sat", value: 4 },
  { label: "Sun", value: 1 },
]

const DUMMY_LEADERBOARD = [
  { rank: 1, name: "Rahul K.", score: 1240, you: false },
  { rank: 2, name: "Priya S.", score: 1185, you: false },
  { rank: 3, name: "You", score: 1150, you: true },
  { rank: 4, name: "Amit D.", score: 1080, you: false },
  { rank: 5, name: "Sunita M.", score: 1020, you: false },
]

const DUMMY_TIME_SPENT = "12h 45m"

export default function HomePage() {
  const user = useAuthStore((s) => s.user)
  const { data: exams = [], isLoading: examsLoading } = useQuery({
    queryKey: ["exams"],
    queryFn: () => examQueries.list(),
  })
  const { data: results = [], isLoading: resultsLoading } = useQuery({
    queryKey: ["my-results"],
    queryFn: () => resultQueries.list(),
  })

  const avgScore =
    results.length > 0
      ? results.reduce((s, r) => s + r.score, 0) / results.length
      : null
  const passRate =
    results.length > 0
      ? Math.round((results.filter((r) => r.passed).length / results.length) * 100)
      : null

  const stats = [
    { label: "Available Exams", value: exams.length, icon: BookOpen, color: "text-[var(--primary)]", bg: "bg-[color:var(--color-brand-50)]" },
    { label: "Attempts Made", value: results.length, icon: Clock, color: "text-[color:var(--color-ocean-600)]", bg: "bg-[color:var(--color-ocean-50)]" },
    { label: "Avg Score", value: avgScore != null ? formatScore(avgScore) : "—", icon: TrendingUp, color: "text-[color:var(--color-success-700)]", bg: "bg-[color:var(--color-success-50)]" },
    { label: "Pass Rate", value: passRate != null ? `${passRate}%` : "—", icon: Trophy, color: "text-[color:var(--color-warning-700)]", bg: "bg-[color:var(--color-warning-50)]" },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Good day 👋`}
        description="Here's your exam portal overview"
        action={
          <Button asChild>
            <Link href="/exams">Browse Exams</Link>
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg} shrink-0`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-xs text-[var(--muted-foreground)] font-medium">{label}</p>
                {examsLoading || resultsLoading ? (
                  <Skeleton className="h-6 w-12 mt-1" />
                ) : (
                  <p className="text-2xl font-bold">{value}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Results */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Results</CardTitle>
          </CardHeader>
          <CardContent>
            {resultsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : results.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">No attempts yet</p>
            ) : (
              <div className="space-y-2">
                {results.slice(0, 5).map((r) => (
                  <Link
                    key={r.attempt_id}
                    href={`/results/${r.attempt_id}`}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2.5 hover:bg-[var(--secondary)] transition-colors group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.exam_title}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">{formatScore(r.score)}</p>
                    </div>
                    <StatusBadge status={r.passed ? "passed" : "failed_exam"} />
                  </Link>
                ))}
              </div>
            )}
            {results.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full mt-3" asChild>
                <Link href="/results">View all results →</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Available Exams */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Available Exams</CardTitle>
          </CardHeader>
          <CardContent>
            {examsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : exams.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">No exams published yet</p>
            ) : (
              <div className="space-y-2">
                {exams.slice(0, 5).map((e) => (
                  <Link
                    key={e.id}
                    href={`/exams/${e.id}`}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2.5 hover:bg-[var(--secondary)] transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">{e.total_questions} Qs · {e.duration_minutes} min</p>
                    </div>
                    <span className="text-xs font-medium text-[var(--primary)] capitalize shrink-0">{e.exam_type}</span>
                  </Link>
                ))}
              </div>
            )}
            <Button variant="ghost" size="sm" className="w-full mt-3" asChild>
              <Link href="/exams">Browse all →</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Analytics & Leaderboard */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Performance Trend */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">Performance Progress</CardTitle>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">Score trend over your last 7 attempts</p>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <LineChart data={DUMMY_PERFORMANCE} />
            </div>
            <div className="flex justify-between text-xs text-[var(--muted-foreground)] mt-3 px-2">
              {DUMMY_PERFORMANCE.map((d) => (
                <span key={d.label}>{d.label}</span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Daily Attempts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[color:var(--color-ocean-600)]" />
              <CardTitle className="text-base">Attempts This Week</CardTitle>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">Number of attempts per day</p>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <BarChart data={DUMMY_ATTEMPTS} />
            </div>
            <div className="flex justify-between text-xs text-[var(--muted-foreground)] mt-3 px-2">
              {DUMMY_ATTEMPTS.map((d) => (
                <span key={d.label}>{d.label}</span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Medal className="h-4 w-4 text-[color:var(--color-warning-700)]" />
              <CardTitle className="text-base">Leaderboard</CardTitle>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">Top performers this week</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {DUMMY_LEADERBOARD.map((entry) => (
                <div
                  key={entry.rank}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${
                    entry.you ? "bg-[color:var(--color-brand-50)] border-[var(--primary)]" : "border-[var(--border)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        entry.rank === 1
                          ? "bg-yellow-100 text-yellow-700"
                          : entry.rank === 2
                          ? "bg-gray-100 text-gray-700"
                          : entry.rank === 3
                          ? "bg-orange-100 text-orange-700"
                          : "bg-[var(--secondary)] text-[var(--secondary-foreground)]"
                      }`}
                    >
                      {entry.rank}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{entry.name} {entry.you && <span className="text-xs text-[var(--primary)]">(You)</span>}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">{entry.score} pts</p>
                    </div>
                  </div>
                  {entry.rank <= 3 && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                      {entry.rank === 1 ? "Gold" : entry.rank === 2 ? "Silver" : "Bronze"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Time Spent */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-[color:var(--color-success-700)]" />
              <CardTitle className="text-base">Total Time Spent</CardTitle>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">Time spent on the platform</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--color-success-50)] mb-4">
                <Clock className="h-8 w-8 text-[color:var(--color-success-700)]" />
              </div>
              <p className="text-3xl font-bold text-[color:var(--color-success-700)]">{DUMMY_TIME_SPENT}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">Keep learning!</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
