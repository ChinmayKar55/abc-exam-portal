import { apiGet } from "@/lib/api"

export interface QuestionReview {
  position: number
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: string
  your_answer: string
  is_correct: boolean
  explanation: string
}

export interface Result {
  attempt_id: string
  exam_id: string
  exam_title: string
  user_id: string
  status: string
  score: number
  raw_score: number
  total_marks: number
  passed: boolean
  total_questions: number
  correct_answers: number
  wrong_answers: number
  unattempted: number
  marks_per_question: number
  negative_marking: boolean
  negative_penalty: number
  review?: QuestionReview[]
}

export const resultQueries = {
  list: () =>
    apiGet<{ data: Result[]; success: boolean }>("my/results")
      .then((r) => r.data ?? []),

  get: (attemptId: string, withReview = false) =>
    apiGet<{ data: Result; success: boolean }>(
      `attempts/${attemptId}/result`,
      withReview ? { review: "true" } : undefined
    ).then((r) => r.data),
}
