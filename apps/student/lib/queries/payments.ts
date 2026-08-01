import { apiGet } from "@/lib/api"

export interface Payment {
  id: string
  order_id: string
  payment_id: string | null
  amount_paise: number
  base_amount_paise: number
  tax_paise: number
  tax_rate: number
  currency: string
  type: "plan_purchase" | "subscription_purchase"
  status: "pending" | "captured" | "failed" | "refunded"
  item_name: string
  tier?: string
  plan_id?: string
  duration_days?: number
  created_at: string
  updated_at: string
}

export const paymentQueries = {
  list: () =>
    apiGet<{ data: Payment[]; success: boolean }>("my/payments").then((r) => r.data ?? []),

  get: (orderId: string) =>
    apiGet<{ data: Payment; success: boolean }>(`my/payments/${orderId}`).then((r) => r.data),
}
