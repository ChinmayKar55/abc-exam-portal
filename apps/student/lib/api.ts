import ky, { type KyInstance } from "ky"
import { useAuthStore } from "@/store/auth"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081/api"

/** Ky instance with automatic JWT injection and token refresh on 401 */
export const api: KyInstance = ky.create({
  prefixUrl: API_BASE,
  timeout: 15_000,
  hooks: {
    beforeRequest: [
      (request) => {
        const token = useAuthStore.getState().accessToken
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`)
        }
      },
    ],
    afterResponse: [
      async (_request, _options, response) => {
        if (response.status === 401) {
          // Attempt silent refresh
          try {
            const res = await ky.post(`${API_BASE}/auth/refresh`, {
              credentials: "include",
            }).json<{ access_token: string }>()
            useAuthStore.getState().setToken(res.access_token)
          } catch {
            useAuthStore.getState().logout()
          }
        }
        return response
      },
    ],
  },
})

/** Typed API helpers */
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
