"use client"
import type { ReactNode } from "react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { MobileNav } from "@/components/layout/MobileNav"
import { useAuthStore } from "@/store/auth"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const hydrated = useAuthStore.persist.hasHydrated()

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace("/login")
    }
  }, [hydrated, isAuthenticated, router])

  // While hydrating or if not authenticated, render nothing (redirect fires in effect)
  if (!hydrated || !isAuthenticated) return null

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      {/* Mobile nav */}
      <MobileNav />
      <main className="flex-1 min-w-0 lg:ml-60">
        <div className="p-4 pt-18 lg:pt-6 lg:p-8 max-w-6xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  )
}
