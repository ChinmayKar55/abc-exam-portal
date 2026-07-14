"use client"
import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Menu, X, GraduationCap, BookOpen, LayoutDashboard, Trophy, User, CreditCard, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/auth"
import { authQueries } from "@/lib/queries/auth"

const nav = [
  { href: "/home",    label: "Dashboard",  icon: LayoutDashboard },
  { href: "/exams",   label: "Exams",      icon: BookOpen },
  { href: "/results", label: "My Results", icon: Trophy },
  { href: "/plans",   label: "Plans",      icon: CreditCard },
  { href: "/profile", label: "Profile",    icon: User },
]

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    try { await authQueries.logout() } catch {}
    logout()
    router.push("/login")
  }

  return (
    <>
      {/* Mobile topbar */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-50 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-brand">
            <GraduationCap className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-bold text-sm">ABC Exam</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--secondary)]"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div className={cn(
        "lg:hidden fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] transition-transform duration-300",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-14 items-center justify-between px-5 border-b border-[var(--sidebar-border)]">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-brand">
              <GraduationCap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-white text-sm">ABC Exam Portal</span>
          </div>
          <button onClick={() => setOpen(false)} className="text-[var(--sidebar-fg)] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-fg)]"
                    : "text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover-bg)] hover:text-white"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-[var(--sidebar-border)] p-3">
          <div className="flex items-center gap-3 px-2 py-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--sidebar-active-bg)] text-white text-xs font-bold shrink-0">
              {user?.name?.[0]?.toUpperCase() ?? "S"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{user?.name}</p>
              <p className="truncate text-xs text-[var(--sidebar-fg)]">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover-bg)] hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </>
  )
}
