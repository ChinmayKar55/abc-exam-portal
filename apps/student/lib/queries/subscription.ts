import { apiGet, apiPost } from "@/lib/api"

export interface SubscriptionPlan {
  id: string
  tier: "free" | "pro" | "max"
  name: string
  description: string
  price_paise: number
  duration_days: number
  duration_label?: string
  features: string[]
}

export interface UserSubscription {
  id: string
  user_id: string
  tier: "free" | "pro" | "max"
  active: boolean
  expires_at?: string
  started_at: string
}

export interface SubscribeResult {
  order_id: string
  amount_paise: number
  base_amount_paise: number
  tax_paise: number
  total_paise: number
  tax_rate: number
  currency: string
  mock_checkout_url?: string
  key_id?: string
}

export interface SubscribeResponse {
  success: boolean
  data: SubscribeResult
}

export interface SubscribeRequest {
  tier: "pro" | "max"
}

export interface VerifyPaymentRequest {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export interface VerifyPaymentResponse {
  success: boolean
  message?: string
}

export const subscriptionQueries = {
  list: () =>
    apiGet<{ data: SubscriptionPlan[]; success: boolean }>("subscription-plans")
      .then((r) => r.data ?? []),

  mySubscription: () =>
    apiGet<{ data: UserSubscription | null; success: boolean }>("my/subscription")
      .then((r) => r.data),

  subscribe: (payload: SubscribeRequest) =>
    apiPost<SubscribeResponse>("subscriptions/subscribe", payload)
      .then((r) => r.data),

  upgrade: (payload: SubscribeRequest) =>
    apiPost<SubscribeResponse>("subscriptions/upgrade", payload)
      .then((r) => r.data),

  verifyPayment: (payload: VerifyPaymentRequest) =>
    apiPost<VerifyPaymentResponse>("subscriptions/verify", payload),
}
