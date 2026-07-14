import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api"

export interface ExamSource {
  bank_id: string
  bank_name: string
  question_count: number
  pinned_question_ids?: string[] // undefined/empty = random selection
}

export interface Exam {
  id: string
  title: string
  description: string
  exam_type: "mock" | "practice"
  total_questions: number
  duration_minutes: number
  pass_mark_pct: number
  marks_per_question: number
  negative_marking: boolean
  negative_penalty: number
  shuffle: boolean
  status: "draft" | "active" | "archived"
  sources: ExamSource[]
  created_at: string
}

export interface ExamSet {
  id: string
  name: string
  description: string
  question_count: number
}

export interface CreateExamInput {
  title: string
  description: string
  exam_type: "mock" | "practice"
  duration_minutes: number
  pass_mark_pct: number
  marks_per_question: number
  negative_marking: boolean
  negative_penalty: number
  shuffle: boolean
  status: "draft" | "active"
  sources: ExamSource[]
}

export const examQueries = {
  list: () =>
    apiGet<{ data: Exam[]; success: boolean }>("admin/exams").then((r) => r.data ?? []),

  get: (id: string) =>
    apiGet<{ data: Exam; success: boolean }>(`exams/${id}`).then((r) => r.data),

  create: (data: CreateExamInput) =>
    apiPost<{ data: Exam; success: boolean }>("exams", data).then((r) => r.data),

  update: (id: string, data: Partial<CreateExamInput>) =>
    apiPut<{ data: Exam; success: boolean }>(`exams/${id}`, data).then((r) => r.data),

  publish: (id: string) =>
    apiPost<{ success: boolean }>(`exams/${id}/publish`),

  delete: (id: string) =>
    apiDelete<{ success: boolean }>(`exams/${id}`).then((r) => r.success),

  examSets: () =>
    apiGet<{ data: ExamSet[]; success: boolean }>("exam-sets").then((r) => r.data ?? []),

  createExamSet: (data: { name: string; description: string }) =>
    apiPost<{ data: ExamSet; success: boolean }>("exam-sets", data).then((r) => r.data),

  updateExamSet: (id: string, data: { name?: string; description?: string }) =>
    apiPut<{ data: ExamSet; success: boolean }>(`exam-sets/${id}`, data).then((r) => r.data),

  deleteExamSet: (id: string) =>
    apiDelete<{ success: boolean }>(`exam-sets/${id}`).then((r) => r.success),

  examSetQuestions: (id: string, page = 1) =>
    apiGet<{ data: Question[]; meta: { total: number }; success: boolean }>(`exam-sets/${id}/questions`, { page, limit: 500 }).then((r) => r.data ?? []),

  createQuestion: (data: {
    exam_set_id: string
    question_text: string
    option_a: string
    option_b: string
    option_c: string
    option_d: string
    correct_option: string
    explanation: string
    difficulty: string
  }) => apiPost<{ data: Question; success: boolean }>("questions", data).then((r) => r.data),

  updateQuestion: (id: string, data: Partial<Question>) =>
    apiPut<{ data: Question; success: boolean }>(`questions/${id}`, data).then((r) => r.data),

  deleteQuestion: (id: string) =>
    apiDelete<{ success: boolean }>(`questions/${id}`).then((r) => r.success),

  fetchBankQuestions: (bankId: string) =>
    apiGet<{ data: Question[]; meta: { total: number }; success: boolean }>(`exam-sets/${bankId}/questions`, { page: 1, limit: 500 }).then((r) => r.data ?? []),
}

export interface Question {
  id: string
  exam_set_id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: string
  explanation: string
  difficulty: string
  active: boolean
  created_at: string
}
