import { apiGet, apiPut } from "@/lib/api"

export interface SubscriptionPlan {
  id: string
  tier: string
  name: string
  description: string
  price_paise: number
  duration_days: number
  active: boolean
}

export interface BulkTierRequest {
  exam_ids: string[]
  access_tier: "free" | "pro" | "max"
}

export const subscriptionQueries = {
  list: () =>
    apiGet<{ data: SubscriptionPlan[]; success: boolean }>("admin/subscription-plans").then((r) => r.data ?? []),

  update: (tier: string, data: Partial<SubscriptionPlan>) =>
    apiPut<{ data: SubscriptionPlan; success: boolean }>(`admin/subscription-plans/${tier}`, data).then((r) => r.data),

  bulkTier: (data: BulkTierRequest) =>
    apiPut<{ success: boolean }>("admin/exams/bulk-tier", data),
}
