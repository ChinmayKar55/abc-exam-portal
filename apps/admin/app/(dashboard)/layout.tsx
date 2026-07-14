import type { ReactNode } from "react"
import { AdminSidebar } from "@/components/layout/AdminSidebar"
import { AdminMobileNav } from "@/components/layout/MobileNav"
import { AuthGuard } from "@/components/layout/AuthGuard"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-[var(--background)]">
        <div className="hidden lg:block">
          <AdminSidebar />
        </div>
        <AdminMobileNav />
        <main className="flex-1 min-w-0 lg:ml-60">
          <div className="p-4 pt-18 lg:pt-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}
