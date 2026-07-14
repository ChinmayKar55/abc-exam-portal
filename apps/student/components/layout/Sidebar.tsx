"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BookOpen, LayoutDashboard, FileText, Trophy, User, LogOut, CreditCard,
} from "lucide-react"
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

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    try { await authQueries.logout() } catch {}
    logout()
    router.push("/login")
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)]">
      {/* Logo */}
      <div className="flex h-16 items-center gap-1 px-3 border-b border-[var(--sidebar-border)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/osssc-logo.png"
          alt="OSSSC Online"
          style={{ width: 56, height: 56, minWidth: 56 }}
          className="object-contain"
        />
        <span className="font-extrabold text-white text-[14px] tracking-wide leading-tight">OSSSC ONLINE</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
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

      {/* User footer */}
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
    </aside>
  )
}
