import ky, { type KyInstance } from "ky"
import { useAuthStore } from "@/store/auth"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081/api"

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise
  refreshPromise = ky
    .post(`${API_BASE}/auth/refresh`, { credentials: "include" })
    .json<{ access_token: string }>()
    .then((r) => {
      useAuthStore.getState().setToken(r.access_token)
      return r.access_token
    })
    .catch(() => {
      useAuthStore.getState().logout()
      return null
    })
    .finally(() => { refreshPromise = null })
  return refreshPromise
}

export const api: KyInstance = ky.create({
  prefixUrl: API_BASE,
  timeout: 20_000,
  credentials: "include",
  hooks: {
    beforeRequest: [
      (request) => {
        const token = useAuthStore.getState().accessToken
        if (token) request.headers.set("Authorization", `Bearer ${token}`)
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        if (response.status === 401) {
          const newToken = await refreshAccessToken()
          if (newToken) {
            request.headers.set("Authorization", `Bearer ${newToken}`)
            return ky(request)
          }
        }
        return response
      },
    ],
  },
})

export async function apiGet<T>(path: string, searchParams?: Record<string, string | number>): Promise<T> {
  return api.get(path, { searchParams: searchParams as Record<string, string> }).json<T>()
}
export async function apiPost<T>(path: string, json?: unknown): Promise<T> {
  return api.post(path, { json }).json<T>()
}
export async function apiPut<T>(path: string, json?: unknown): Promise<T> {
  return api.put(path, { json }).json<T>()
}
export async function apiDelete<T>(path: string): Promise<T> {
  return api.delete(path).json<T>()
}
