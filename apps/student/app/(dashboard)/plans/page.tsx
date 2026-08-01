"use client"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle2, Zap, BookOpen, FileText, AlertCircle } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { planQueries, type Plan, type PlanExam, type PlanMaterial } from "@/lib/queries/plans"
import { subscriptionQueries } from "@/lib/queries/subscription"
import { useAuthReady } from "@/lib/providers"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

export default function PlansPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAuthReady = useAuthReady()
  const [successMsg, setSuccessMsg] = useState("")

  // Detect redirect back from mock payment gateway
  useEffect(() => {
    if (searchParams.get("payment") === "success") {
      setSuccessMsg("Payment successful! Your package is now active.")
      qc.invalidateQueries({ queryKey: ["my-plans"] })
      router.replace("/plans", { scroll: false })
    }
  }, [searchParams, qc, router])

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: planQueries.list,
  })

  const { data: myPlans = [], isLoading: myPlansLoading } = useQuery({
    queryKey: ["my-plans"],
    queryFn: planQueries.myPlans,
    enabled: isAuthReady,
  })

  const { data: mySub } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: subscriptionQueries.mySubscription,
    enabled: isAuthReady,
  })

  const isMax = mySub?.tier === "max"
  const isProOrMax = mySub?.tier === "pro" || mySub?.tier === "max"

  useEffect(() => {
    if (isProOrMax) {
      router.replace("/subscription")
    }
  }, [isProOrMax, router])

  return (
    <div className="space-y-6">
      <PageHeader title="Packages" description="Add specific exams and study materials to your account on top of your plan" />

      {/* Max plan subscribers have all packages included */}
      {isMax && (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-[color:var(--color-success-500)]/30 bg-[color:var(--color-success-50)] px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-[color:var(--color-success-500)] shrink-0 mt-0.5" />
          <div className="text-sm space-y-0.5">
            <p className="font-semibold text-[color:var(--color-success-700)]">You have Max</p>
            <p className="text-[color:var(--color-success-700)]">All packages are included in your Max plan.</p>
          </div>
        </div>
      )}

      {/* Active plans banner — shows all owned plans */}
      {!myPlansLoading && myPlans.length > 0 && (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-[color:var(--color-success-500)]/30 bg-[color:var(--color-success-50)] px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-[color:var(--color-success-500)] shrink-0 mt-0.5" />
          <div className="text-sm space-y-0.5">
            <p className="font-semibold text-[color:var(--color-success-700)]">Your active plans:</p>
            {myPlans.map((up) => (
              <p key={up.plan_id} className="text-[color:var(--color-success-700)]">
                {up.plan_name}
                {up.expires_at && (
                  <span> · Expires {formatDate(up.expires_at)}</span>
                )}
              </p>
            ))}
          </div>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[color:var(--color-success-500)]/30 bg-[color:var(--color-success-50)] px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-[color:var(--color-success-500)] shrink-0" />
          <p className="text-sm font-medium text-[color:var(--color-success-700)]">{successMsg}</p>
        </div>
      )}


      {plansLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => <Card key={i}><CardContent className="p-6 space-y-3"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-10 w-3/4" /><Skeleton className="h-4 w-full" /></CardContent></Card>)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.filter((p) => p.active).map((plan) => {
            const ownedPlanIDs = new Set(myPlans.map((up) => up.plan_id))
            const isCurrent = ownedPlanIDs.has(plan.id) || isMax
            const isPopular = plans.indexOf(plan) === 1
            const buttonLabel = isMax ? "Included with Max" : isCurrent ? "Owned" : "Get started"
            return (
              <Card
                key={plan.id}
                className={cn(
                  "flex flex-col relative",
                  isPopular && "border-[var(--primary)] shadow-[var(--shadow-brand)]"
                )}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="default" className="gap-1 shadow-sm">
                      <Zap className="h-3 w-3" /> Most popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <p className="text-xs text-[var(--muted-foreground)]">{plan.description}</p>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div>
                    <span className="text-3xl font-bold">{formatCurrency(plan.price_paise)}</span>
                    <p className="text-sm text-[var(--muted-foreground)] mt-1">
                      {plan.duration_days > 0 ? `Valid for ${plan.duration_days} days` : "Lifetime access"}
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {plan.exams?.map((e: PlanExam) => (
                      <li key={e.id} className="flex items-center gap-2 text-sm">
                        <BookOpen className="h-4 w-4 text-[color:var(--color-success-500)] shrink-0" />
                        {e.title}
                      </li>
                    ))}
                    {plan.materials?.map((m: PlanMaterial) => (
                      <li key={m.id} className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-[color:var(--color-brand-500)] shrink-0" />
                        {m.title}
                      </li>
                    ))}
                    {!plan.exams?.length && !plan.materials?.length && (
                      <li className="text-sm text-[var(--muted-foreground)]">No content attached</li>
                    )}
                  </ul>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent}
                    onClick={() => !isMax && router.push(`/checkout?type=package&planId=${plan.id}`)}
                  >
                    {buttonLabel}
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
