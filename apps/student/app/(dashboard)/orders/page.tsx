"use client"

import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Receipt, Crown, Package, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { paymentQueries, type Payment } from "@/lib/queries/payments"
import { formatCurrency, formatDate } from "@/lib/utils"

function statusVariant(status: Payment["status"]) {
  switch (status) {
    case "captured":
      return "success"
    case "refunded":
      return "secondary"
    case "failed":
      return "destructive"
    default:
      return "outline"
  }
}

export default function OrdersPage() {
  const router = useRouter()
  const { data: payments = [], isLoading, error } = useQuery({
    queryKey: ["payments"],
    queryFn: paymentQueries.list,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Orders" description="View all your purchases and receipts." />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-1/3 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Orders" description="Unable to load your order history." />
        <Card>
          <CardContent className="p-6 flex items-start gap-3 text-red-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm">Failed to load orders. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Orders" description="You have not made any purchases yet." />
        <Card>
          <CardContent className="p-6 text-center text-sm text-[var(--muted-foreground)]">
            No orders found.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Orders" description="View all your purchases and download receipts." />

      <div className="space-y-4">
        {payments.map((payment) => {
          const isSubscription = payment.type === "subscription_purchase"
          const itemName = payment.item_name || (isSubscription ? "Subscription" : "Package")
          const canViewReceipt = payment.status === "captured" || payment.status === "refunded"
          return (
            <Card key={payment.id}>
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-2 rounded-full bg-[var(--muted)]/50">
                      {isSubscription ? <Crown className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-semibold">{itemName}</p>
                      <p className="text-sm text-[var(--muted-foreground)]">Order ID: {payment.order_id}</p>
                      {payment.payment_id && <p className="text-sm text-[var(--muted-foreground)]">Payment ID: {payment.payment_id}</p>}
                      <p className="text-sm text-[var(--muted-foreground)]">{formatDate(payment.created_at)}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant={statusVariant(payment.status)} className="capitalize">
                          {payment.status}
                        </Badge>
                        {payment.tier && <Badge variant="secondary" className="capitalize">{payment.tier}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col md:items-end gap-3">
                    <p className="font-bold text-lg">{formatCurrency(payment.amount_paise)}</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canViewReceipt}
                        onClick={() => router.push(`/payment/success?order_id=${payment.order_id}&payment_id=${payment.payment_id ?? ""}`)}
                      >
                        <Receipt className="h-4 w-4 mr-2" /> View receipt
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
