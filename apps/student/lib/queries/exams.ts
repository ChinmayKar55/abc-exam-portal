import { apiGet, apiPost } from "@/lib/api"

export interface ExamSource {
  bank_id: string
  bank_name: string
  question_count: number
}

export interface Exam {
  id: string
  title: string
  description: string
  exam_type: string
  total_questions: number
  duration_minutes: number
  pass_mark_pct: number
  shuffle: boolean
  status: string
  sources: ExamSource[]
  created_at: string
}

export interface ShuffledQuestion {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  position: number
}

export interface StartResponse {
  attempt_id: string
  exam_id: string
  exam_title: string
  duration_minutes: number
  expires_at: string
  questions: ShuffledQuestion[]
  saved_answers: Record<string, string>
}

export interface Attempt {
  id: string
  user_id: string
  exam_id: string
  status: string
  started_at: string
  submitted_at?: string
  score?: number
  passed?: boolean
  total_questions: number
  correct_answers?: number
}

export const examQueries = {
  list: (examType?: string) =>
    apiGet<{ data: Exam[]; success: boolean }>("exams", examType ? { exam_type: examType } : undefined)
      .then((r) => r.data),

  get: (id: string) =>
    apiGet<{ data: Exam; success: boolean }>(`exams/${id}`)
      .then((r) => r.data),

  start: (examId: string) =>
    apiPost<{ data: StartResponse; success: boolean }>(`exams/${examId}/start`)
      .then((r) => r.data),

  saveAnswer: (attemptId: string, questionId: string, answer: string) =>
    apiPost(`attempts/${attemptId}/answers`, { question_id: questionId, answer }),

  submit: (attemptId: string) =>
    apiPost<{ data: Attempt; success: boolean }>(`attempts/${attemptId}/submit`)
      .then((r) => r.data),

  myAttempts: () =>
    apiGet<{ data: Attempt[]; success: boolean }>("my/attempts")
      .then((r) => r.data ?? []),
}
