import { apiGet } from "@/lib/api"

export interface AdminStats {
  total_users: number
  total_questions: number
  total_exams: number
  total_attempts: number
  revenue_captured_paise: number
}

export interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  email_verified: boolean
  created_at: string
  plan_id: string | null
  plan_name: string | null
  plan_active: boolean | null
}

export interface AdminAttempt {
  id: string
  user_name: string
  user_email: string
  exam_title: string
  status: string
  score: number | null
  started_at: string
  submitted_at: string | null
  violation_count: number
  is_flagged: boolean
}

export interface ProctoringViolation {
  id: string
  event_type: string
  severity: string
  occurred_at: string
  meta: Record<string, unknown>
}

export interface AdminUpload {
  id: string
  filename: string
  parse_status: string
  questions_extracted: number
  questions_published: number
  uploaded_by: string
  uploaded_at: string
}

export interface ListMeta {
  total: number
  page: number
  page_size: number
}

export const adminQueries = {
  stats: () =>
    apiGet<{ data: AdminStats; success: boolean }>("admin/stats").then((r) => r.data),

  users: (page = 1, search = "") =>
    apiGet<{ data: AdminUser[]; meta: ListMeta; success: boolean }>("admin/users", {
      page,
      page_size: 20,
      ...(search ? { search } : {}),
    }),

  attempts: (page = 1) =>
    apiGet<{ data: AdminAttempt[]; meta: ListMeta; success: boolean }>("admin/attempts", {
      page,
      page_size: 20,
    }),

  violations: (attemptId: string) =>
    apiGet<{ data: ProctoringViolation[]; success: boolean }>(`admin/attempts/${attemptId}/violations`)
      .then((r) => r.data ?? []),

  uploads: (page = 1) =>
    apiGet<{ data: AdminUpload[]; meta: ListMeta; success: boolean }>("admin/uploads", {
      page,
      page_size: 20,
    }),
}
