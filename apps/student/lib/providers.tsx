"use client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useAuthStore } from "@/store/auth"
import ky from "ky"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081/api"

const AuthReadyContext = createContext(false)

export const useAuthReady = () => useContext(AuthReadyContext)

export function Providers({ children }: { children: ReactNode }) {
  const [isAuthReady, setIsAuthReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      // 1. Restore token/user from localStorage before any authenticated query fires.
      await useAuthStore.persist.rehydrate()

      // 2. Sync the restored token to a cookie so the API middleware can read it
      // even if the store has not propagated to all consumers yet.
      const token = useAuthStore.getState().accessToken
      if (token) {
        document.cookie = `abc-auth-token=${token}; path=/; SameSite=Lax`
      }

      // 3. Attempt a silent refresh so a hard refresh after expiry does not leave
      // stale data in the cache. If it succeeds the token is updated; if it fails,
      // the user will be logged out by the standard 401 handler.
      try {
        const r = await ky
          .post(`${API_BASE}/auth/refresh`, { credentials: "include" })
          .json<{ access_token: string }>()
        if (!cancelled) {
          useAuthStore.getState().setToken(r.access_token)
        }
      } catch {
        // Ignore: the access token in the store may still be valid, or the
        // next 401 will be handled by the global afterResponse hook.
      }

      if (!cancelled) {
        setIsAuthReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <AuthReadyContext.Provider value={isAuthReady}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </AuthReadyContext.Provider>
  )
}
