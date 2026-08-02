"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuthStore } from "@/store/auth"
import { authQueries } from "@/lib/queries/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

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
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-10 gradient-brand text-white">
        <a href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/osssc-logo.png"
            alt="OSSSC Online"
            className="h-24 w-24 object-contain drop-shadow-md shrink-0"
          />
          <span className="text-xl font-bold tracking-tight whitespace-nowrap">OSSSC ONLINE</span>
        </a>
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
              <p className="text-sm text-[var(--muted-foreground)]">Admin Panel</p>
            </div>
          </div>

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
                  <Label htmlFor="password">Password</Label>
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
        </div>
      </div>
    </div>
  )
}
