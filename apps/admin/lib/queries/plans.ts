import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api"

export interface Plan {
  id: string
  name: string
  description: string
  price_paise: number
  active: boolean
  exams: PlanExam[]
  materials: PlanMaterial[]
  created_at: string
}

export interface PlanExam {
  id: string
  title: string
}

export interface PlanMaterial {
  id: string
  title: string
}

export interface CreatePlanInput {
  name: string
  description: string
  price_paise: number
  active: boolean
  exam_ids: string[]
  material_ids: string[]
}

export interface StudyMaterial {
  id: string
  title: string
  description: string
  file_url: string
}

export const planQueries = {
  list: () =>
    apiGet<{ data: Plan[]; success: boolean }>("plans").then((r) => r.data ?? []),

  get: (id: string) =>
    apiGet<{ data: Plan; success: boolean }>(`plans/${id}`).then((r) => r.data),

  create: (data: CreatePlanInput) =>
    apiPost<{ data: Plan; success: boolean }>("plans", data).then((r) => r.data),

  update: (id: string, data: Partial<CreatePlanInput>) =>
    apiPut<{ data: Plan; success: boolean }>(`plans/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiDelete<{ success: boolean }>(`plans/${id}`).then((r) => r.success),

  materials: () =>
    apiGet<{ data: StudyMaterial[]; success: boolean }>("study-materials").then((r) => r.data ?? []),
}
