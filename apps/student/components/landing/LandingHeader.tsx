"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const pathname = usePathname() ?? ""

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24)
    window.addEventListener("scroll", handler)
    return () => window.removeEventListener("scroll", handler)
  }, [])

  const navLinks = [
    { label: "Exams", href: "/#exams" },
    { label: "Plans", href: "/#plans" },
    { label: "Blogs", href: "/blogs" },
    { label: "About", href: "/#about" },
  ]

  return (
    <nav
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-sky-100" : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-24">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 lg:gap-3 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/osssc-logo.png"
            alt="OSSSC Online"
            className="h-27 w-22 object-contain drop-shadow-md shrink-0 translate-y-[9px]"
          />
          <span
            className={cn(
              "font-extrabold text-lg lg:text-xl tracking-widest leading-tight whitespace-nowrap",
              scrolled ? "text-sky-900" : "text-white"
            )}
          >
            OSSSC ONLINE
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-4 lg:gap-8 shrink-0">
          {navLinks.map(({ label, href }) => {
            const isRoute = href.startsWith("/")
            const isActive = isRoute && pathname.startsWith(href)
            const className = cn(
              "text-sm font-medium transition-colors hover:text-sky-400 whitespace-nowrap",
              isActive
                ? (scrolled ? "text-sky-600" : "text-sky-300")
                : (scrolled ? "text-slate-700" : "text-white/90")
            )
            return isRoute ? (
              <Link
                key={label}
                href={href}
                className={className}
                aria-current={isActive ? "page" : undefined}
              >
                {label}
              </Link>
            ) : (
              <a key={label} href={href} className={className}>
                {label}
              </a>
            )
          })}
        </div>

        {/* CTAs */}
        <div className="hidden md:flex items-center gap-2 lg:gap-3 shrink-0">
          <Link
            href="/login"
            className={cn(
              "text-sm font-semibold px-3 lg:px-4 py-2 rounded-lg transition-colors whitespace-nowrap",
              scrolled ? "text-sky-700 hover:bg-sky-50" : "text-white/90 hover:text-white"
            )}
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="text-sm font-semibold px-3 lg:px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white transition-colors shadow-md whitespace-nowrap"
          >
            Start Free →
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          className={cn("md:hidden p-2", scrolled ? "text-slate-700" : "text-white")}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-b border-sky-100 px-4 py-4 space-y-3">
          {navLinks.map(({ label, href }) => {
            const isRoute = href.startsWith("/")
            const isActive = isRoute && pathname.startsWith(href)
            return (
              <Link
                key={label}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "block text-sm font-medium py-1",
                  isActive ? "text-sky-600 font-semibold" : "text-slate-700 hover:text-sky-600"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {label}
              </Link>
            )
          })}
          <div className="flex gap-3 pt-2">
            <Link
              href="/login"
              className="flex-1 text-center text-sm font-semibold px-4 py-2 rounded-lg border border-sky-200 text-sky-700"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="flex-1 text-center text-sm font-semibold px-4 py-2 rounded-lg bg-sky-500 text-white"
            >
              Start Free
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
