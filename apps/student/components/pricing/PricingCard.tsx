"use client"

import Link from "next/link"
import { CheckCircle2, Crown, Sparkles, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn, formatCurrency, calculateGST } from "@/lib/utils"

export interface PricingPlan {
  tier: "free" | "pro" | "max"
  name: string
  description?: string
  pricePaise: number
  durationLabel: string
  features: string[]
  isPopular?: boolean
  ctaLabel: string
  ctaAction?: () => void
  ctaHref?: string
  disabled?: boolean
  current?: boolean
}

const tierIcons = {
  free: Sparkles,
  pro: Zap,
  max: Crown,
}

export const tierFeatures: Record<string, string[]> = {
  free: [
    "5 full-length mock tests / month",
    "1,000+ practice MCQs",
    "1 exam series access",
    "Basic performance report",
    "Community support",
    "No credit card required",
  ],
  pro: [
    "30+ full-length mock tests",
    "10,000+ MCQ question bank",
    "All Nursing & Paramedical series",
    "OMR + CBT exam formats",
    "AI-proctored tests",
    "Detailed analytics & PDF reports",
    "Priority email support",
  ],
  max: [
    "50+ advanced mock tests",
    "20,000+ MCQs incl. previous papers",
    "Live doubt sessions",
    "Weekly test series",
    "Rank predictor tool",
    "Everything in Pro",
    "1-on-1 expert guidance",
    "Early access to new exams",
  ],
}

export const tierDescriptions: Record<string, string> = {
  free: "Get started with free practice tests.",
  pro: "Best for serious OSSSC aspirants.",
  max: "Complete intensive prep bundle.",
}

interface PricingCardProps {
  plan: PricingPlan
  theme: "landing" | "dashboard"
}

export function PricingCard({ plan, theme }: PricingCardProps) {
  const Icon = tierIcons[plan.tier]
  const tax = calculateGST(plan.pricePaise)
  const total = plan.pricePaise + tax

  const isLanding = theme === "landing"
  const isFree = plan.pricePaise === 0

  const wrapper = cn(
    "relative rounded-3xl p-8 flex flex-col h-full transition-all duration-300",
    isLanding
      ? plan.isPopular
        ? "bg-gradient-to-b from-sky-600 to-sky-700 border-2 border-sky-500 shadow-2xl shadow-sky-500/25 scale-[1.02]"
        : plan.tier === "max"
          ? "bg-slate-900 border-2 border-slate-800 shadow-xl"
          : "bg-white border-2 border-slate-200 hover:border-sky-300 hover:shadow-xl"
      : plan.isPopular
        ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-2 border-[var(--primary)] shadow-xl"
        : plan.tier === "max"
          ? "bg-[var(--card)] border-2 border-[var(--border)] shadow-md"
          : "bg-[var(--card)] border-2 border-[var(--border)] hover:border-[var(--primary)]/40 hover:shadow-lg"
  )

  const textPrimary = isLanding
    ? plan.isPopular || plan.tier === "max" ? "text-white" : "text-slate-900"
    : plan.isPopular ? "text-[var(--primary-foreground)]" : "text-[var(--card-foreground)]"

  const textMuted = isLanding
    ? plan.isPopular || plan.tier === "max" ? "text-sky-100" : "text-slate-500"
    : plan.isPopular ? "text-[var(--primary-foreground)]/80" : "text-[var(--muted-foreground)]"

  const badgeClasses = cn(
    "absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full w-fit whitespace-nowrap",
    isLanding
      ? plan.isPopular
        ? "bg-white text-sky-700"
        : plan.tier === "max"
          ? "bg-sky-500 text-white"
          : "bg-slate-100 text-slate-700"
      : plan.isPopular
        ? "bg-[var(--primary-foreground)] text-[var(--primary)]"
        : plan.tier === "max"
          ? "bg-[var(--secondary)] text-[var(--secondary-foreground)]"
          : "bg-[var(--muted)] text-[var(--muted-foreground)]"
  )

  const ctaClasses = cn(
    "w-full font-bold py-3 rounded-xl text-sm transition-all",
    isLanding
      ? plan.isPopular
        ? "bg-white text-sky-700 hover:bg-sky-50"
        : plan.tier === "max"
          ? "bg-sky-500 hover:bg-sky-400 text-white"
          : "bg-sky-500 hover:bg-sky-600 text-white"
      : plan.isPopular
        ? "bg-[var(--primary-foreground)] text-[var(--primary)] hover:bg-[var(--primary-foreground)]/90"
        : plan.tier === "max"
          ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90"
          : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90"
  )

  const action = plan.ctaAction ? (
    <Button className={ctaClasses} disabled={plan.disabled} onClick={plan.ctaAction}>
      {plan.ctaLabel}
    </Button>
  ) : plan.ctaHref ? (
    <Link href={plan.ctaHref} className={cn(ctaClasses, "block text-center")}>
      {plan.ctaLabel}
    </Link>
  ) : (
    <Button className={ctaClasses} disabled>
      {plan.ctaLabel}
    </Button>
  )

  return (
    <div className={wrapper}>
      {plan.isPopular && (
        <div className={badgeClasses}>
          <Zap className="h-3 w-3" /> Most Popular
        </div>
      )}
      {plan.tier === "max" && !plan.isPopular && (
        <div className={badgeClasses}>
          <Crown className="h-3 w-3" /> All Access
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center",
            isLanding
              ? plan.isPopular || plan.tier === "max" ? "bg-white/20 text-white" : "bg-sky-100 text-sky-600"
              : plan.isPopular ? "bg-[var(--primary-foreground)]/20 text-[var(--primary-foreground)]" : "bg-[var(--muted)] text-[var(--primary)]"
          )}>
            <Icon className="h-5 w-5" />
          </div>
          <h3 className={cn("text-lg font-bold", textPrimary)}>{plan.name}</h3>
        </div>
        {plan.description && <p className={cn("text-sm", textMuted)}>{plan.description}</p>}
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-2">
          <span className={cn("text-5xl font-extrabold tracking-tight", textPrimary)}>
            {isFree ? "Free" : formatCurrency(plan.pricePaise)}
          </span>
          {!isFree && (
            <span className={cn("text-sm font-medium", textMuted)}>/{plan.durationLabel}</span>
          )}
        </div>
        {!isFree && (
          <div className="mt-1">
            <p className={cn("text-xs font-medium", textMuted)}>Exclusive of GST</p>
            <p className={cn("text-sm", textMuted)}>
              Pay {formatCurrency(total)} incl. 18% GST
            </p>
          </div>
        )}
        {isFree && (
          <p className={cn("text-sm mt-1", textMuted)}>
            No credit card required
          </p>
        )}
      </div>

      <ul className="space-y-3 flex-1 mb-8">
        {plan.features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-3 text-sm">
            <CheckCircle2 className={cn(
              "h-5 w-5 shrink-0 mt-0.5",
              isLanding
                ? plan.isPopular || plan.tier === "max" ? "text-sky-200" : "text-sky-500"
                : plan.isPopular ? "text-[var(--primary-foreground)]" : "text-[color:var(--color-success-500)]"
            )} />
            <span className={cn("leading-relaxed", textMuted)}>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto">
        {plan.current && plan.tier !== "free" ? (
          <Button className={cn(ctaClasses, "opacity-100 cursor-default")} disabled>
            Current Plan
          </Button>
        ) : (
          action
        )}
      </div>
    </div>
  )
}
