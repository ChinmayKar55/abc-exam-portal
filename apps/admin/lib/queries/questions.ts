import { apiGet, apiPost, apiPut } from "@/lib/api"
import { api } from "@/lib/api"

export interface Question {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: string
  explanation: string
  exam_set_id: string
  difficulty: string
  created_at: string
}

export interface ParsedQuestion {
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: string
  explanation: string
}

export interface Upload {
  id: string
  filename: string
  parse_status: string
  questions_extracted: number
  questions_published: number
  uploaded_at: string
}

export interface UploadPreview {
  upload_id: string
  parse_status: string
  questions_extracted: number
  questions: ParsedQuestion[]
}

export const questionQueries = {
  list: (page = 1, examSetId?: string) =>
    apiGet<{ data: Question[]; meta: { total: number }; success: boolean }>(
      "questions",
      { page, page_size: 50, ...(examSetId ? { exam_set_id: examSetId } : {}) }
    ),

  upload: (file: File) => {
    const form = new FormData()
    form.append("file", file)
    return api.post("questions/upload", { body: form }).json<{ upload_id: string; questions_extracted: number; success: boolean }>()
      .then((r) => r.upload_id ? { id: r.upload_id, questions_extracted: r.questions_extracted } : null)
  },

  preview: (uploadId: string) =>
    apiGet<{ data: UploadPreview; success: boolean }>(`questions/uploads/${uploadId}/preview`).then((r) => r.data),

  updateParsed: (uploadId: string, idx: number, question: ParsedQuestion) =>
    apiPut<{ data: ParsedQuestion; success: boolean }>(`questions/uploads/${uploadId}/questions/${idx}`, question).then((r) => r.data),

  publish: (uploadId: string, examSetId: string) =>
    apiPost<{ success: boolean; questions_published: number }>(`questions/uploads/${uploadId}/publish`, { exam_set_id: examSetId }),

  uploads: () =>
    apiGet<{ data: Upload[]; success: boolean }>("admin/uploads").then((r) => r.data ?? []),
}
