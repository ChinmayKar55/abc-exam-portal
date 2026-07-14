import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:     "bg-[var(--primary)] text-[var(--primary-foreground)]",
        secondary:   "bg-[var(--secondary)] text-[var(--secondary-foreground)]",
        outline:     "border border-[var(--border)] text-[var(--foreground)]",
        destructive: "bg-[color:var(--color-danger-50)] text-[color:var(--color-danger-700)] border border-[color:var(--color-danger-500)]/30",
        success:     "bg-[color:var(--color-success-50)] text-[color:var(--color-success-700)] border border-[color:var(--color-success-500)]/30",
        warning:     "bg-[color:var(--color-warning-50)] text-[color:var(--color-warning-700)] border border-[color:var(--color-warning-500)]/30",
        ocean:       "bg-[color:var(--color-ocean-100)] text-[color:var(--color-ocean-700)] border border-[color:var(--color-ocean-500)]/30",
        brand:       "bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-700)] border border-[color:var(--color-brand-500)]/30",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
