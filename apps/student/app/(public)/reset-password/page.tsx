"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState, Suspense } from "react"
import { Loader2, ArrowLeft } from "lucide-react"
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/schemas/auth"
import { authQueries } from "@/lib/queries/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

function ResetPasswordSkeleton() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
    </div>
  )
}

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const onSubmit = async (data: ResetPasswordInput) => {
    if (!token) return
    try {
      await authQueries.resetPassword(token, data.password)
      setSuccess(true)
    } catch {}
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold">Password reset successful</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          You can now sign in with your new password.
        </p>
        <Link
          href="/login"
          className="text-[var(--primary)] text-sm font-medium hover:underline"
        >
          ← Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Reset password</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Enter a new password for your account
        </p>
      </div>

      {!token && (
        <p className="text-sm text-[var(--destructive)]">
          Reset link is invalid or expired. Please request a new one.
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            {...register("password")}
            className={cn(errors.password && "border-[var(--destructive)]")}
          />
          {errors.password && (
            <p className="text-xs text-[var(--destructive)]">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            {...register("confirm")}
            className={cn(errors.confirm && "border-[var(--destructive)]")}
          />
          {errors.confirm && (
            <p className="text-xs text-[var(--destructive)]">
              {errors.confirm.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || !token}
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Reset password
        </Button>
      </form>

      <Link
        href="/login"
        className="flex items-center justify-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
      </Link>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordSkeleton />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
