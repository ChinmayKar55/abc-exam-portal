"use client"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { Loader2, MailCheck } from "lucide-react"
import { otpSchema, type OtpInput } from "@/lib/schemas/auth"
import { authQueries } from "@/lib/queries/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function OtpForm() {
  const router = useRouter()
  const params = useSearchParams()
  const email = params.get("email") ?? ""
  const [serverError, setServerError] = useState("")
  const [resent, setResent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OtpInput>({ resolver: zodResolver(otpSchema) })

  const onSubmit = async (data: OtpInput) => {
    setServerError("")
    try {
      await authQueries.verifyEmail(email, data.otp)
      router.push("/login?verified=1")
    } catch {
      setServerError("Invalid or expired OTP. Please try again.")
    }
  }

  const handleResend = async () => {
    try {
      await authQueries.resendOtp(email)
      setResent(true)
      setTimeout(() => setResent(false), 5000)
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--color-brand-100)]">
          <MailCheck className="h-7 w-7 text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            We sent a 6-digit code to <span className="font-medium text-[var(--foreground)]">{email}</span>
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="otp">Verification code</Label>
          <Input
            id="otp"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            className={cn("text-center text-xl tracking-[0.5em] font-mono", errors.otp && "border-[var(--destructive)]")}
            {...register("otp")}
          />
          {errors.otp && <p className="text-xs text-[var(--destructive)] text-center">{errors.otp.message}</p>}
        </div>

        {serverError && (
          <p className="text-sm text-[var(--destructive)] bg-[color:var(--color-danger-50)] border border-[color:var(--color-danger-500)]/20 rounded-[var(--radius)] px-3 py-2 text-center">
            {serverError}
          </p>
        )}
        {resent && (
          <p className="text-sm text-[color:var(--color-success-700)] bg-[color:var(--color-success-50)] rounded-[var(--radius)] px-3 py-2 text-center">
            New code sent!
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Verify email
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--muted-foreground)]">
        Didn&apos;t receive it?{" "}
        <button onClick={handleResend} className="text-[var(--primary)] font-medium hover:underline">
          Resend code
        </button>
      </p>
    </div>
  )
}
