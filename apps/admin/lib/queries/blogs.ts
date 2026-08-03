import { api, apiDelete, apiGet, apiPost, apiPut } from "@/lib/api"

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

export interface CreateBlogInput {
  title: string
  subtitle: string
  content: string
  published: boolean
}

export const blogQueries = {
  list: () =>
    apiGet<{ data: Blog[]; success: boolean }>("admin/blogs").then((r) => r.data ?? []),

  get: (id: string) =>
    apiGet<{ data: Blog; success: boolean }>(`admin/blogs/${id}`).then((r) => r.data),

  create: (data: CreateBlogInput) =>
    apiPost<{ data: Blog; success: boolean }>("admin/blogs", data).then((r) => r.data),

  update: (id: string, data: Partial<CreateBlogInput>) =>
    apiPut<{ data: Blog; success: boolean }>(`admin/blogs/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiDelete<{ success: boolean }>(`admin/blogs/${id}`).then((r) => r.success),

  uploadImage: (file: File) => {
    const form = new FormData()
    form.append("file", file)
    return api.post("admin/blogs/images", { body: form }).json<{ url: string; success: boolean }>().then((r) => r.url)
  },
}
