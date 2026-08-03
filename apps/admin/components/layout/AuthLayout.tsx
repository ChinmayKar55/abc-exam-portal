"use client"

import Link from "next/link"

interface AuthLayoutProps {
  children: React.ReactNode
  subtitle?: string
}

export default function AuthLayout({ children, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-10 gradient-brand text-white">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/osssc-logo.png"
            alt="OSSSC Online"
            className="h-24 w-24 object-contain drop-shadow-md shrink-0"
          />
          <span className="text-xl font-bold tracking-tight whitespace-nowrap">OSSSC ONLINE</span>
        </Link>
        <div className="space-y-4">
          <h2 className="text-3xl font-bold leading-tight">
            Manage smarter.<br />Drive results.
          </h2>
          <p className="text-white/75 text-base max-w-xs">
            Admin tools for questions, exams, attempts, and subscriptions.
          </p>
        </div>
        <p className="text-sm text-white/50">© {new Date().getFullYear()} OSSSC Online</p>
      </div>

      {/* Right — Form area */}
      <div className="flex items-center justify-center p-6 bg-[var(--background)]">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-3 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/osssc-logo.png"
              alt="OSSSC Online"
              className="h-16 w-16 object-contain drop-shadow-md"
            />
            <div className="text-center">
              <h1 className="text-2xl font-bold">OSSSC ONLINE</h1>
              {subtitle && (
                <p className="text-sm text-[var(--muted-foreground)]">{subtitle}</p>
              )}
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
