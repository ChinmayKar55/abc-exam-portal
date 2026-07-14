"use client"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useState } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { registerSchema, type RegisterInput } from "@/lib/schemas/auth"
import { authQueries } from "@/lib/queries/auth"
import { useAuthStore } from "@/store/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function RegisterForm() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [showPw, setShowPw] = useState(false)
  const [serverError, setServerError] = useState("")

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) })

  const onSubmit = async (data: RegisterInput) => {
    setServerError("")
    try {
      const res = await authQueries.register(data)
      setAuth(res.user, res.access_token)
      router.push("/home")
    } catch {
      setServerError("Registration failed. Email may already be in use.")
    }
  }

  const fields = [
    { id: "name", label: "Full Name", type: "text", placeholder: "Dr. Jane Smith", autoComplete: "name" },
    { id: "email", label: "Email", type: "email", placeholder: "you@example.com", autoComplete: "email" },
    { id: "phone", label: "Phone", type: "tel", placeholder: "9876543210", autoComplete: "tel" },
  ] as const

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Create account</h1>
        <p className="text-sm text-[var(--muted-foreground)]">Start your exam preparation journey</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {fields.map(({ id, label, type, placeholder, autoComplete }) => (
          <div key={id} className="space-y-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Input
              id={id}
              type={type}
              placeholder={placeholder}
              autoComplete={autoComplete}
              {...register(id)}
              className={cn(errors[id] && "border-[var(--destructive)]")}
            />
            {errors[id] && <p className="text-xs text-[var(--destructive)]">{errors[id]?.message}</p>}
          </div>
        ))}

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPw ? "text" : "password"}
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              autoComplete="new-password"
              {...register("password")}
              className={cn("pr-10", errors.password && "border-[var(--destructive)]")}
            />
            <button
              type="button"
              onClick={() => setShowPw((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-[var(--destructive)]">{errors.password.message}</p>}
        </div>

        {serverError && (
          <p className="text-sm text-[var(--destructive)] bg-[color:var(--color-danger-50)] border border-[color:var(--color-danger-500)]/20 rounded-[var(--radius)] px-3 py-2">
            {serverError}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--muted-foreground)]">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--primary)] font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
