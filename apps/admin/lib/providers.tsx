"use client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, useEffect, type ReactNode } from "react"
import { useAuthStore } from "@/store/auth"
import ky from "ky"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081/api"

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    useAuthStore.persist.rehydrate()
    // Silently restore access token from httpOnly refresh cookie on every page load
    ky.post(`${API_BASE}/auth/refresh`, { credentials: "include" })
      .json<{ access_token: string }>()
      .then((r) => useAuthStore.getState().setToken(r.access_token))
      .catch(() => {})
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
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
