"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Lock,
  ShieldCheck,
  CreditCard,
  Smartphone,
  Landmark,
  Wallet,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  BookOpen,
  FileText,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { planQueries, type Plan, type PlanExam, type PlanMaterial, type PurchaseResult } from "@/lib/queries/plans"
import {
  subscriptionQueries,
  type SubscriptionPlan,
  type SubscribeResult,
} from "@/lib/queries/subscription"
import { useRazorpay } from "@/hooks/useRazorpay"
import { useAuthStore } from "@/store/auth"
import { useAuthReady } from "@/lib/providers"
import { formatCurrency, calculateGST } from "@/lib/utils"

const supportEmail = "abcsupportindia@gmail.com"
const supportPhone = "+91 89848 58895"

export default function CheckoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()
  const { openCheckout } = useRazorpay()
  const authUser = useAuthStore((s) => s.user)
  const isAuthReady = useAuthReady()

  const type = searchParams.get("type") as "subscription" | "package" | null
  const tier = searchParams.get("tier") as "pro" | "max" | null
  const planId = searchParams.get("planId") as string | null
  const isUpgrade = searchParams.get("upgrade") === "true"

  const [agreed, setAgreed] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [isPaying, setIsPaying] = useState(false)

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: planQueries.list,
    enabled: type === "package",
  })

  const { data: subPlans = [], isLoading: subPlansLoading } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: subscriptionQueries.list,
    enabled: type === "subscription",
  })

  const { data: mySub, isLoading: mySubLoading } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: subscriptionQueries.mySubscription,
    enabled: isAuthReady && type === "subscription",
  })

  const selectedPlan = type === "package" ? plans.find((p) => p.id === planId) : null
  const selectedTier =
    type === "subscription" ? subPlans.find((p) => p.tier === tier) : null


  const verifyPlanMutation = useMutation({
    mutationFn: planQueries.verifyPayment,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["my-plans"] })
      router.push(`/payment/success?order_id=${vars.razorpay_order_id}&payment_id=${vars.razorpay_payment_id}`)
    },
    onError: (err: Error) => {
      setIsPaying(false)
      setErrorMsg(err.message || "Payment verification failed. Please contact support.")
    },
  })

  const verifySubMutation = useMutation({
    mutationFn: subscriptionQueries.verifyPayment,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["my-subscription"] })
      router.push(`/payment/success?order_id=${vars.razorpay_order_id}&payment_id=${vars.razorpay_payment_id}`)
    },
    onError: (err: Error) => {
      setIsPaying(false)
      setErrorMsg(err.message || "Payment verification failed. Please contact support.")
    },
  })

  const handleRazorpaySuccess = (data: SubscribeResult | PurchaseResult) =>
    (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
      setIsPaying(true)
      if (type === "package") {
        verifyPlanMutation.mutate({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
        })
      } else {
        verifySubMutation.mutate({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
        })
      }
    }

  const purchaseMutation = useMutation({
    mutationFn: () => (planId ? planQueries.purchase(planId) : Promise.reject(new Error("Invalid plan"))),
    onMutate: () => {
      setErrorMsg("")
      setIsPaying(true)
    },
    onSuccess: (data) => handlePurchaseSuccess(data),
    onError: (err: Error) => {
      setIsPaying(false)
      setErrorMsg(err.message || "Unable to start purchase. Please try again.")
    },
  })

  const subscribeMutation = useMutation({
    mutationFn: () =>
      tier ? subscriptionQueries.subscribe({ tier }) : Promise.reject(new Error("Invalid tier")),
    onMutate: () => {
      setErrorMsg("")
      setIsPaying(true)
    },
    onSuccess: (data) => handlePurchaseSuccess(data),
    onError: (err: Error) => {
      setIsPaying(false)
      setErrorMsg(err.message || "Unable to start subscription. Please try again.")
    },
  })

  const upgradeMutation = useMutation({
    mutationFn: () => subscriptionQueries.upgrade({ tier: "max" }),
    onMutate: () => {
      setErrorMsg("")
      setIsPaying(true)
    },
    onSuccess: (data) => handlePurchaseSuccess(data),
    onError: (err: Error) => {
      setIsPaying(false)
      setErrorMsg(err.message || "Unable to start upgrade. Please try again.")
    },
  })

  function handlePurchaseSuccess(data: SubscribeResult | PurchaseResult) {
    setIsPaying(false)
    if (data?.mock_checkout_url) {
      window.location.href = data.mock_checkout_url
      return
    }

    if (data?.key_id && data?.order_id && (selectedTier || selectedPlan)) {
      const name =
        type === "subscription"
          ? selectedTier?.name ?? "Subscription"
          : selectedPlan?.name ?? "Package"
      openCheckout({
        key: data.key_id,
        amount: data.total_paise ?? data.amount_paise,
        currency: data.currency,
        order_id: data.order_id,
        name: "OSSSC Online",
        description: name,
        prefill: {
          name: authUser?.name ?? "",
          email: authUser?.email ?? "",
        },
        theme: { color: type === "subscription" && tier === "max" ? "#7c3aed" : "#0284c7" },
        onSuccess: handleRazorpaySuccess(data),
        onDismiss: () => setIsPaying(false),
        onError: () => {
          setIsPaying(false)
          setErrorMsg("Payment failed or was cancelled. Please try again.")
        },
      })
      return
    }

    setErrorMsg("Unable to start payment. Please try again.")
  }

  function handlePay() {
    if (!agreed) {
      setErrorMsg("Please accept the Terms & Conditions, Privacy Policy and Refund Policy to continue.")
      return
    }
    setErrorMsg("")
    if (type === "package") {
      purchaseMutation.mutate()
    } else if (isUpgrade) {
      upgradeMutation.mutate()
    } else {
      subscribeMutation.mutate()
    }
  }

  const isLoading =
    (type === "package" && plansLoading) ||
    (type === "subscription" && (subPlansLoading || mySubLoading)) ||
    !isAuthReady

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <PageHeader title="Checkout" description="Review your order before paying." />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!type || (type === "subscription" && !selectedTier) || (type === "package" && !selectedPlan)) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <PageHeader title="Checkout" description="Review your order before paying." />
        <Card>
          <CardContent className="p-6 text-center text-sm text-[var(--muted-foreground)]">
            Invalid checkout link. Please go back and select a plan or package.
          </CardContent>
          <CardFooter className="justify-center pb-6">
            <Button onClick={() => router.push("/subscription")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> View plans
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const plan = type === "package" ? (selectedPlan as Plan) : null
  const subPlan = type === "subscription" ? (selectedTier as SubscriptionPlan) : null

  const item = (plan ?? subPlan) as Plan | SubscriptionPlan

  const basePaise = item.price_paise
  const taxPaise = calculateGST(basePaise)
  const totalPaise = basePaise + taxPaise

  const durationText =
    type === "subscription" && subPlan
      ? subPlan.duration_label
      : plan && plan.duration_days > 0
        ? `Valid for ${plan.duration_days} days`
        : "Lifetime access"

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader title="Checkout" description="Review your order and pay securely." />

      {errorMsg && (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-red-500/30 bg-red-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm font-medium text-red-700">{errorMsg}</p>
        </div>
      )}

      <div className="grid md:grid-cols-5 gap-6">
        <div className="md:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success-500)]" />
                Order summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">{item.description}</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">{durationText}</p>
                </div>
                <p className="font-semibold">{formatCurrency(basePaise)}</p>
              </div>

              {type === "package" && plan && (
                <div className="space-y-2">
                  {plan.exams?.length ? (
                    <div className="space-y-1">
                      {plan.exams.map((e: PlanExam) => (
                        <div key={e.id} className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                          <BookOpen className="h-3.5 w-3.5" /> {e.title}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {plan.materials?.length ? (
                    <div className="space-y-1">
                      {plan.materials.map((m: PlanMaterial) => (
                        <div key={m.id} className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                          <FileText className="h-3.5 w-3.5" /> {m.title}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              {type === "subscription" && subPlan && subPlan.features?.length ? (
                <ul className="space-y-1">
                  {subPlan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--color-success-500)]" />
                      {feature}
                    </li>
                  ))}
                </ul>
              ) : null}

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Price (excl. tax)</span>
                  <span>{formatCurrency(basePaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">GST ({18}%)</span>
                  <span>{formatCurrency(taxPaise)}</span>
                </div>
                <div className="flex justify-between font-semibold text-base pt-2">
                  <span>Total payable</span>
                  <span>{formatCurrency(totalPaise)}</span>
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">Price is exclusive of taxes. 18% GST is added at checkout.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Secure & compliant payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <ShieldCheck className="h-4 w-4 text-[color:var(--color-success-500)]" />
                <span>PCI-DSS compliant checkout via Razorpay</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1 font-normal">
                  <Smartphone className="h-3 w-3" /> UPI
                </Badge>
                <Badge variant="secondary" className="gap-1 font-normal">
                  <CreditCard className="h-3 w-3" /> Cards
                </Badge>
                <Badge variant="secondary" className="gap-1 font-normal">
                  <Landmark className="h-3 w-3" /> Net Banking
                </Badge>
                <Badge variant="secondary" className="gap-1 font-normal">
                  <Wallet className="h-3 w-3" /> Wallets
                </Badge>
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                Your card / UPI details are never stored on our servers. Razorpay handles the payment securely.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{authUser?.name || "—"}</p>
              <p className="text-[var(--muted-foreground)]">{authUser?.email || "—"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Support & policies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                <HelpCircle className="h-4 w-4" />
                <span>
                  <a href={`mailto:${supportEmail}`} className="underline hover:text-[var(--primary)]">
                    {supportEmail}
                  </a>
                </span>
              </div>
              <p className="text-[var(--muted-foreground)]">{supportPhone}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <a href="/" target="_blank" rel="noopener noreferrer" className="underline text-[var(--muted-foreground)] hover:text-[var(--primary)]">
                  Terms & Conditions
                </a>
                <span className="text-[var(--muted-foreground)]">·</span>
                <a href="/" target="_blank" rel="noopener noreferrer" className="underline text-[var(--muted-foreground)] hover:text-[var(--primary)]">
                  Privacy Policy
                </a>
                <span className="text-[var(--muted-foreground)]">·</span>
                <a href="/" target="_blank" rel="noopener noreferrer" className="underline text-[var(--muted-foreground)] hover:text-[var(--primary)]">
                  Refund Policy
                </a>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <label className="flex items-start gap-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
                />
                <span className="text-[var(--muted-foreground)]">
                  I agree to the{" "}
                  <a href="/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--primary)]">Terms & Conditions</a>,{" "}
                  <a href="/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--primary)]">Privacy Policy</a>{" "}
                  and{" "}
                  <a href="/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--primary)]">Refund Policy</a>.
                </span>
              </label>

              <Button
                className="w-full"
                disabled={!agreed || isPaying || purchaseMutation.isPending || subscribeMutation.isPending || upgradeMutation.isPending}
                onClick={handlePay}
              >
                {(isPaying || purchaseMutation.isPending || subscribeMutation.isPending || upgradeMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                {isPaying || purchaseMutation.isPending || subscribeMutation.isPending || upgradeMutation.isPending
                  ? "Processing..."
                  : `Pay securely ${formatCurrency(totalPaise)}`}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() =>
                  router.push(type === "subscription" ? "/subscription" : "/plans")
                }
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
