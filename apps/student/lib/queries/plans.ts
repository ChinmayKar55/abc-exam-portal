import { apiGet, apiPost } from "@/lib/api"

export interface PlanExam {
  id: string
  title: string
}

export interface PlanMaterial {
  id: string
  title: string
}

export interface Plan {
  id: string
  name: string
  description: string
  price_paise: number
  duration_days: number
  features: string[] | Record<string, boolean>
  active: boolean
  exams: PlanExam[]
  materials: PlanMaterial[]
}

export interface UserPlan {
  id: string
  plan_id: string
  plan_name: string
  activated_at: string
  expires_at?: string
  active: boolean
  exams: PlanExam[]
  materials: PlanMaterial[]
}

export interface PurchaseResult {
  order_id: string
  amount_paise: number
  currency: string
  mock_checkout_url?: string
  key_id?: string
}

export interface PurchaseResponse {
  success: boolean
  data: PurchaseResult
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

export const planQueries = {
  list: () =>
    apiGet<{ data: Plan[]; success: boolean }>("plans")
      .then((r) => r.data ?? []),

  /** Returns ALL active plans the user owns (multi-plan support). */
  myPlans: () =>
    apiGet<{ data: UserPlan[] | UserPlan | null; success: boolean }>("my/plan")
      .then((r) => {
        const d = r.data
        if (Array.isArray(d)) return d
        if (d && typeof d === "object") return [d as UserPlan]
        return []
      }),

  /** @deprecated — use myPlans() instead. Returns first plan or null. */
  myPlan: () =>
    planQueries.myPlans().then((plans) => (plans.length > 0 ? plans[0] : null)),

  purchase: (planId: string) =>
    apiPost<PurchaseResponse>(`plans/${planId}/purchase`)
      .then((r) => r.data),

  verifyPayment: (payload: VerifyPaymentRequest) =>
    apiPost<VerifyPaymentResponse>("verify-payment", payload)
      .then((r) => r.data),
}
