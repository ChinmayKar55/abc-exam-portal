"use client"

import { useState } from "react"
import Link from "next/link"
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await apiPost<MessageResponse>("auth/forgot-password", { email })
      setSent(true)
    } catch (err: any) {
      setError(err?.message ?? "Failed to send reset link. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthLayout subtitle="Reset Password">
        <Card>
          <CardContent className="pt-6 space-y-4 text-center">
            <h2 className="text-xl font-bold">Check your inbox</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              If that email is registered, we sent a password reset link.
            </p>
            <Button asChild className="w-full">
              <Link href="/login">Back to sign in</Link>
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
          <CardTitle className="text-base">Forgot password</CardTitle>
          <CardDescription>Enter your email and we&apos;ll send a reset link</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@osssconline.com"
                required
                autoComplete="email"
              />
            </div>
            {error && (
              <p className="text-sm text-[var(--destructive)] bg-[color:var(--color-danger-50)] border border-[color:var(--color-danger-500)]/20 rounded-[var(--radius)] px-3 py-2">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Send reset link
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
