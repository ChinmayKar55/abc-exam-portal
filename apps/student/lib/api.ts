import ky, { type KyInstance } from "ky"
import { useAuthStore } from "@/store/auth"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081/api"

function getAccessToken(): string | null {
  const fromStore = useAuthStore.getState().accessToken
  if (fromStore) return fromStore

  // Fallback to the cookie that is set on login and synced on rehydration.
  // This closes the hydration race where the store may not yet be restored
  // when the first authenticated request is made.
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/(?:^|; )abc-auth-token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

/** Ky instance with automatic JWT injection and token refresh on 401 */
export const api: KyInstance = ky.create({
  prefixUrl: API_BASE,
  timeout: 15_000,
  credentials: "include",
  hooks: {
    beforeRequest: [
      (request) => {
        const token = getAccessToken()
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`)
        }
      },
    ],
    afterResponse: [
      async (_request, _options, response) => {
        if (response.status === 401) {
          // Attempt silent refresh. The caller (e.g. React Query) will refetch
          // with the new token on its next attempt.
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
