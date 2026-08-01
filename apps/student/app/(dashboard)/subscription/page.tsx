"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { PricingCard, type PricingPlan, tierFeatures, tierDescriptions } from "@/components/pricing/PricingCard"
import {
  subscriptionQueries,
  type SubscriptionPlan,
} from "@/lib/queries/subscription"
import { useAuthReady } from "@/lib/providers"
import { formatDate, formatDurationLabel } from "@/lib/utils"

export default function SubscriptionPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAuthReady = useAuthReady()
  const [successMsg, setSuccessMsg] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    if (searchParams.get("payment") === "success") {
      setSuccessMsg("Payment successful! Your subscription is now active.")
      qc.invalidateQueries({ queryKey: ["my-subscription"] })
      router.replace("/subscription", { scroll: false })
    }
  }, [searchParams, qc, router])

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: subscriptionQueries.list,
  })

  // Inject a virtual Free plan so the catalog always shows the cumulative ladder
  const allPlans: SubscriptionPlan[] = [
    {
      id: "free",
      tier: "free",
      name: "Free",
      description: tierDescriptions.free,
      price_paise: 0,
      duration_days: 0,
      active: true,
      duration_label: "forever",
      features: tierFeatures.free,
    } as SubscriptionPlan,
    ...plans.map((p) => ({
      ...p,
      description: tierDescriptions[p.tier] ?? p.description,
      features: tierFeatures[p.tier] ?? p.features,
    })),
  ]

  const { data: mySub, isLoading: mySubLoading } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: subscriptionQueries.mySubscription,
    enabled: isAuthReady,
  })

  const currentTier = mySub?.tier ?? "free"

  const handleSelect = (tier: "pro" | "max") => {
    if (currentTier === "pro" && tier === "max") {
      router.push(`/checkout?type=subscription&tier=max&upgrade=true`)
      return
    }
    router.push(`/checkout?type=subscription&tier=${tier}`)
  }

  const isLoading = plansLoading || mySubLoading

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Plan"
        description="Choose a plan. Each plan includes everything from the previous one."
      />

      {mySub?.active && (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-[color:var(--color-success-500)]/30 bg-[color:var(--color-success-50)] px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-[color:var(--color-success-500)] shrink-0 mt-0.5" />
          <div className="text-sm space-y-0.5">
            <p className="font-semibold text-[color:var(--color-success-700)] capitalize">
              Your plan: {mySub.tier}
            </p>
            {mySub.expires_at && (
              <p className="text-[color:var(--color-success-700)]">
                Expires {formatDate(mySub.expires_at)}
              </p>
            )}
          </div>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[color:var(--color-success-500)]/30 bg-[color:var(--color-success-50)] px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-[color:var(--color-success-500)] shrink-0" />
          <p className="text-sm font-medium text-[color:var(--color-success-700)]">{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-red-500/30 bg-red-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm font-medium text-red-700">{errorMsg}</p>
        </div>
      )}

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto items-stretch">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[520px] rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto items-stretch">
          {allPlans.map((plan) => {
            const isCurrent = currentTier === plan.tier
            const canUpgrade = currentTier === "pro" && plan.tier === "max"
            const isLocked = currentTier === "max" && plan.tier !== "max"
            const isPopular = plan.tier === "pro"

            const pricingPlan: PricingPlan = {
              tier: plan.tier,
              name: plan.name,
              description: plan.description,
              pricePaise: plan.price_paise,
              durationLabel: plan.duration_label ?? formatDurationLabel(plan.duration_days),
              features: plan.features,
              isPopular,
              current: isCurrent,
              ctaLabel: plan.tier === "free"
                ? isCurrent ? "Current" : "Included"
                : isCurrent
                  ? "Current"
                  : canUpgrade
                    ? "Upgrade"
                    : isLocked
                      ? "Included"
                      : "Subscribe",
              ctaAction: plan.tier === "free" || isCurrent || isLocked
                ? undefined
                : () => handleSelect(plan.tier as "pro" | "max"),
              disabled: isCurrent || isLocked,
            }

            return <PricingCard key={plan.id} plan={pricingPlan} theme="dashboard" />
          })}
        </div>
      )}
    </div>
  )
}
