import type { ReactNode } from "react"
import { GraduationCap } from "lucide-react"

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-10 gradient-brand text-white">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">ABC Exam Portal</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-bold leading-tight">
            Prepare smarter.<br />Score higher.
          </h2>
          <p className="text-white/75 text-base max-w-xs">
            Practice 1000+ curated MCQs across anatomy, physiology, biochemistry and more — with detailed explanations.
          </p>
        </div>
        <p className="text-sm text-white/50">© {new Date().getFullYear()} ABC Exam Portal</p>
      </div>

      {/* Right — Form area */}
      <div className="flex items-center justify-center p-6 bg-[var(--background)]">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
