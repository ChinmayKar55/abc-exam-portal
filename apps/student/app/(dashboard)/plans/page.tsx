"use client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle2, Loader2, Zap, BookOpen, FileText, AlertCircle } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { planQueries, type Plan, type PlanExam, type PlanMaterial } from "@/lib/queries/plans"
import { useRazorpay } from "@/hooks/useRazorpay"
import { useAuthStore } from "@/store/auth"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

export default function PlansPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { openCheckout } = useRazorpay()
  const authUser = useAuthStore((s) => s.user)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  // Detect redirect back from mock payment gateway
  useEffect(() => {
    if (searchParams.get("payment") === "success") {
      setSuccessMsg("Payment successful! Your plan is now active.")
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
  })

  const verifyPaymentMutation = useMutation({
    mutationFn: planQueries.verifyPayment,
    onSuccess: () => {
      setSuccessMsg("Payment successful! Your plan is now active.")
      qc.invalidateQueries({ queryKey: ["my-plans"] })
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || "Payment verification failed. Please contact support.")
    },
  })

  const handleRazorpaySuccess = (plan: Plan) => (response: {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
  }) => {
    verifyPaymentMutation.mutate({
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_order_id: response.razorpay_order_id,
      razorpay_signature: response.razorpay_signature,
    })
  }

  const purchaseMutation = useMutation({
    mutationFn: (planId: string) => planQueries.purchase(planId),
    onMutate: (planId) => {
      setErrorMsg("")
      setPurchasing(planId)
    },
    onSuccess: (data, planId) => {
      setPurchasing(null)
      if (data?.mock_checkout_url) {
        window.location.href = data.mock_checkout_url
        return
      }

      if (data?.key_id && data?.order_id) {
        const plan = plans.find((p) => p.id === planId)
        if (!plan) return

        openCheckout({
          key: data.key_id,
          amount: data.amount_paise,
          currency: data.currency,
          order_id: data.order_id,
          name: "OSSSC Online",
          description: plan.name,
          prefill: {
            name: authUser?.name ?? "",
            email: authUser?.email ?? "",
          },
          theme: { color: "#0284c7" },
          onSuccess: handleRazorpaySuccess(plan),
          onDismiss: () => setPurchasing(null),
          onError: () => {
            setPurchasing(null)
            setErrorMsg("Payment failed or was cancelled. Please try again.")
          },
        })
        return
      }

      setSuccessMsg("Plan activated! Enjoy your exams.")
      qc.invalidateQueries({ queryKey: ["my-plans"] })
    },
    onError: (err: Error) => {
      setPurchasing(null)
      setErrorMsg(err.message || "Unable to start purchase. Please try again.")
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Plans & Pricing" description="Unlock full access to all exam content" />

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

      {errorMsg && (
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-red-500/30 bg-red-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm font-medium text-red-700">{errorMsg}</p>
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
            const isCurrent = ownedPlanIDs.has(plan.id)
            const isPopular = plans.indexOf(plan) === 1
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
                    disabled={isCurrent || purchasing === plan.id}
                    onClick={() => purchaseMutation.mutate(plan.id)}
                  >
                    {purchasing === plan.id && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isCurrent ? "Owned" : "Get started"}
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
