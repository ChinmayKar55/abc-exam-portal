"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Loader2, ArrowLeft } from "lucide-react"
import { apiPost } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import AuthLayout from "@/components/layout/AuthLayout"

interface MessageResponse {
  success: boolean
  message: string
}

function ResetPasswordSkeleton() {
  return (
    <AuthLayout subtitle="Reset Password">
      <Card>
        <CardContent className="py-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--muted-foreground)]" />
          <p className="text-sm text-[var(--muted-foreground)] mt-3">Loading reset form...</p>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!token) {
      setError("Reset link is missing or invalid. Please request a new one.")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)
    try {
      await apiPost<MessageResponse>("auth/reset-password", { token, password })
      setSuccess(true)
    } catch (err: any) {
      setError(err?.message ?? "Failed to reset password. The link may have expired.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AuthLayout subtitle="Reset Password">
        <Card>
          <CardContent className="pt-6 space-y-4 text-center">
            <h2 className="text-xl font-bold">Password reset successful</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              You can now sign in with your new password.
            </p>
            <Button asChild className="w-full">
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout subtitle="Reset Password">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Reset password</CardTitle>
          <CardDescription>Enter a new password for your admin account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>
            {error && (
              <p className="text-sm text-[var(--destructive)] bg-[color:var(--color-danger-50)] border border-[color:var(--color-danger-500)]/20 rounded-[var(--radius)] px-3 py-2">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading || !token}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Reset password
            </Button>
          </form>
        </CardContent>
      </Card>
      <Link
        href="/login"
        className="flex items-center justify-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
      </Link>
    </AuthLayout>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordSkeleton />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
