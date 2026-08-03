import {
  LayoutDashboard, BookOpen, Users, ClipboardList,
  CreditCard, Package, Crown, Library, FileText,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

// Single source of truth for admin dashboard navigation, shared between the
// desktop sidebar (AdminSidebar.tsx) and the mobile drawer (MobileNav.tsx)
// so the two can never drift out of sync again.
export const adminNavItems: NavItem[] = [
  { href: "/dashboard",    label: "Dashboard",       icon: LayoutDashboard },
  { href: "/exams",        label: "Exams",           icon: BookOpen },
  { href: "/exam-sets",    label: "Question Banks",  icon: Library },
  { href: "/blogs",        label: "Blogs",           icon: FileText },
  { href: "/users",        label: "Users",           icon: Users },
  { href: "/attempts",     label: "Attempts",        icon: ClipboardList },
  { href: "/packages",     label: "Packages",        icon: Package },
  { href: "/subscription", label: "Subscription",    icon: Crown },
]
