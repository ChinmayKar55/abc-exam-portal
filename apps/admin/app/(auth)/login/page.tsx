"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuthStore } from "@/store/auth"
import { authQueries } from "@/lib/queries/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import AuthLayout from "@/components/layout/AuthLayout"

export default function AdminLoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await authQueries.login(email, password)
      if (res.user.role !== "admin") {
        setError("Access denied. Admin accounts only.")
        setLoading(false)
        return
      }
      setAuth(res.user, res.access_token)
      router.push("/dashboard")
    } catch {
      setError("Invalid credentials.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout subtitle="Admin Panel">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sign in</CardTitle>
          <CardDescription>Admin accounts only</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@osssconline.com" required autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-xs text-[var(--accent)] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
            </div>
            {error && (
              <p className="text-sm text-[var(--destructive)] bg-[color:var(--color-danger-50)] border border-[color:var(--color-danger-500)]/20 rounded-[var(--radius)] px-3 py-2">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
