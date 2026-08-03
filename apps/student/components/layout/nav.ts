"use client"
import { useQuery } from "@tanstack/react-query"
import {
  BookOpen, LayoutDashboard, Trophy, User, CreditCard, Crown, Receipt,
  type LucideIcon,
} from "lucide-react"
import { subscriptionQueries } from "@/lib/queries/subscription"
import { useAuthReady } from "@/lib/providers"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const baseNav: NavItem[] = [
  { href: "/home",         label: "Dashboard",  icon: LayoutDashboard },
  { href: "/exams",        label: "Exams",      icon: BookOpen },
  { href: "/results",      label: "My Results", icon: Trophy },
  { href: "/plans",        label: "Packages",   icon: CreditCard },
  { href: "/subscription", label: "My Plan",    icon: Crown },
  { href: "/orders",       label: "My Orders",  icon: Receipt },
  { href: "/profile",      label: "Profile",    icon: User },
]

// Single source of truth for student dashboard navigation, shared between
// the desktop sidebar (Sidebar.tsx) and the mobile drawer (MobileNav.tsx)
// so the two can never drift out of sync again.
export function useDashboardNav(): NavItem[] {
  const isAuthReady = useAuthReady()

  const { data: mySub } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: subscriptionQueries.mySubscription,
    enabled: isAuthReady,
  })

  const showPackages = isAuthReady && mySub?.tier !== "pro" && mySub?.tier !== "max"
  return baseNav.filter((item) => item.href !== "/plans" || showPackages)
}
