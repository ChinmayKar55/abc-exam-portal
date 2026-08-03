import { apiGet } from "@/lib/api"

export interface Blog {
  id: string
  title: string
  subtitle: string
  slug: string
  content: string
  published: boolean
  created_at: string
  updated_at: string
}

export const blogQueries = {
  list: () => apiGet<{ data: Blog[]; success: boolean }>("blogs").then((r) => r.data ?? []),
  getBySlug: (slug: string) =>
    apiGet<{ data: Blog; success: boolean }>(`blogs/${slug}`).then((r) => r.data),
}
