"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth"
import { Loader2 } from "lucide-react"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Give Providers time to rehydrate + refresh token (runs in same tick)
    const timer = setTimeout(() => {
      setChecking(false)
      const { user, accessToken } = useAuthStore.getState()
      if (!user && !accessToken) {
        router.replace("/login")
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [router])

  // Also redirect immediately if store clears (logout)
  useEffect(() => {
    if (!checking && !user && !accessToken) {
      router.replace("/login")
    }
  }, [user, accessToken, checking, router])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    )
  }

  if (!user && !accessToken) return null

  return <>{children}</>
}
