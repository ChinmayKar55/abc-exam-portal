"use client"

import { useQuery } from "@tanstack/react-query"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle2, AlertCircle, ArrowRight, Package, Crown, HelpCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { paymentQueries } from "@/lib/queries/payments"
import { formatCurrency, formatDate } from "@/lib/utils"

const supportEmail = "abcsupportindia@gmail.com"
const supportPhone = "+91 89848 58895"

export default function PaymentSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get("order_id") ?? ""
  const paymentId = searchParams.get("payment_id") ?? ""

  const { data: payment, isLoading, error } = useQuery({
    queryKey: ["payment", orderId],
    queryFn: () => paymentQueries.get(orderId),
    enabled: !!orderId,
    retry: 2,
  })

  const isPaymentCaptured = payment && payment.status === "captured"
  const isPaymentFailed = payment && payment.status === "failed"

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!orderId || error) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <PageHeader title="Payment confirmation" description="We could not load your receipt." />
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-3 text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm">Unable to load payment details. If you completed a payment, it may take a moment to appear.</p>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button onClick={() => router.push("/subscription")}>View plans</Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (!isPaymentCaptured) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <PageHeader
          title={isPaymentFailed ? "Payment failed" : "Payment confirmation"}
          description={isPaymentFailed ? "Your payment could not be completed." : "We are still processing your payment."}
        />
        <Card>
          <CardContent className="p-6 space-y-2 text-sm text-[var(--muted-foreground)]">
            <p>Order ID: <span className="font-mono text-foreground">{orderId}</span></p>
            {paymentId && <p>Payment ID: <span className="font-mono text-foreground">{paymentId}</span></p>}
            {isPaymentFailed ? (
              <p>Please try again or contact support if the amount was deducted.</p>
            ) : (
              <p>It may take a few seconds to update. Please refresh or contact support if this persists.</p>
            )}
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button onClick={() => window.location.reload()}>Refresh</Button>
            <Button onClick={() => router.push("/subscription")}>View plans</Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const isSubscription = payment.type === "subscription_purchase"
  const itemName = payment.item_name || (isSubscription ? "Subscription" : "Package")
  const continueHref = isSubscription ? "/exams" : "/exams"
  const alternateHref = isSubscription ? "/subscription" : "/plans"

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[color:var(--color-success-500)]/30 bg-[color:var(--color-success-50)] px-4 py-3">
        <CheckCircle2 className="h-6 w-6 text-[color:var(--color-success-500)] shrink-0" />
        <div>
          <p className="font-semibold text-[color:var(--color-success-700)]">Payment successful</p>
          <p className="text-sm text-[color:var(--color-success-700)]">Your {isSubscription ? "subscription" : "package"} has been activated.</p>
        </div>
      </div>

      <PageHeader
        title="Payment receipt"
        description="Thank you for your purchase. Keep this receipt for your records."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {isSubscription ? <Crown className="h-4 w-4" /> : <Package className="h-4 w-4" />}
            {itemName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Order ID</span>
              <span className="font-mono">{payment.order_id}</span>
            </div>
            {payment.payment_id && (
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Payment ID</span>
                <span className="font-mono">{payment.payment_id}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Date</span>
              <span>{formatDate(payment.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Status</span>
              <span className="capitalize text-[color:var(--color-success-500)]">{payment.status}</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Price (excl. tax)</span>
              <span>{formatCurrency(payment.base_amount_paise)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">GST ({payment.tax_rate}%)</span>
              <span>{formatCurrency(payment.tax_paise)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base pt-2">
              <span>Total paid</span>
              <span>{formatCurrency(payment.amount_paise)}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-3 items-stretch">
          <Button onClick={() => router.push(continueHref)}>
            Continue to exams <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <Button variant="outline" onClick={() => router.push(alternateHref)}>
            {isSubscription ? "Manage subscription" : "View packages"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardContent className="p-6 text-sm text-[var(--muted-foreground)]">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="h-4 w-4" />
            <span className="font-medium text-foreground">Need help?</span>
          </div>
          <p>Email: <a href={`mailto:${supportEmail}`} className="underline hover:text-[var(--primary)]">{supportEmail}</a></p>
          <p>Phone: {supportPhone}</p>
        </CardContent>
      </Card>
    </div>
  )
}
