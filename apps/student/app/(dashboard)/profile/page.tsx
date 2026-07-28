"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useAuthStore } from "@/store/auth"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/shared/PageHeader"
import { planQueries } from "@/lib/queries/plans"
import { resultQueries } from "@/lib/queries/results"
import { authQueries } from "@/lib/queries/auth"
import { profileSchema, type ProfileInput } from "@/lib/schemas/auth"
import { formatDate, formatScore } from "@/lib/utils"
import { BookOpen, FileText, Loader2 } from "lucide-react"

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const { data: myPlan } = useQuery({ queryKey: ["my-plan"], queryFn: planQueries.myPlan })
  const { data: results = [] } = useQuery({ queryKey: ["my-results"], queryFn: resultQueries.list })
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState("")
  const [formSuccess, setFormSuccess] = useState("")

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    values: { name: user?.name ?? "", phone: user?.phone ?? "" },
  })

  const onSubmit = async (data: ProfileInput) => {
    setFormError("")
    setFormSuccess("")
    setIsSaving(true)
    try {
      const res = await authQueries.updateProfile(data)
      setUser(res.user)
      setFormSuccess("Profile updated successfully.")
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update profile. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const avgScore = results.length > 0 ? results.reduce((s, r) => s + r.score, 0) / results.length : null
  const passCount = results.filter((r) => r.passed).length

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Profile" description="Your account details and statistics" />

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col sm:flex-row gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full gradient-brand text-white text-2xl font-bold shrink-0">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    autoComplete="name"
                    {...register("name")}
                    className={errors.name ? "border-[var(--destructive)]" : ""}
                  />
                  {errors.name && <p className="text-xs text-[var(--destructive)]">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    {...register("phone")}
                    className={errors.phone ? "border-[var(--destructive)]" : ""}
                  />
                  {errors.phone && <p className="text-xs text-[var(--destructive)]">{errors.phone.message}</p>}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email ?? ""}
                    disabled
                    readOnly
                    className="bg-[var(--secondary)] opacity-70 cursor-not-allowed"
                  />
                  <p className="text-xs text-[var(--muted-foreground)]">Email cannot be changed.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="brand" className="capitalize">{user?.role}</Badge>
                  {user?.emailVerified && <Badge variant="success">Verified</Badge>}
                </div>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                  Save changes
                </Button>
              </div>

              {formError && (
                <p className="text-sm text-[var(--destructive)] bg-[color:var(--color-danger-50)] border border-[color:var(--color-danger-500)]/20 rounded-[var(--radius)] px-3 py-2">
                  {formError}
                </p>
              )}
              {formSuccess && (
                <p className="text-sm text-[color:var(--color-success-700)] bg-[color:var(--color-success-50)] border border-[color:var(--color-success-500)]/20 rounded-[var(--radius)] px-3 py-2">
                  {formSuccess}
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-[var(--muted-foreground)]">Attempts</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{results.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-[var(--muted-foreground)]">Passed</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-[color:var(--color-success-500)]">{passCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-[var(--muted-foreground)]">Avg Score</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-gradient">{avgScore != null ? formatScore(avgScore) : "—"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-[var(--muted-foreground)]">Active Plan</CardTitle></CardHeader>
          <CardContent>
            {myPlan?.active ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold">{myPlan.plan_name}</p>
                {myPlan.expires_at && <p className="text-xs text-[var(--muted-foreground)]">Expires {formatDate(myPlan.expires_at)}</p>}
                {myPlan.exams && myPlan.exams.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-[var(--muted-foreground)]">Exams</p>
                    <ul className="space-y-1">
                      {myPlan.exams.map((e) => (
                        <li key={e.id} className="flex items-center gap-1.5 text-sm">
                          <BookOpen className="h-3.5 w-3.5 text-[var(--primary)]" /> {e.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {myPlan.materials && myPlan.materials.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-[var(--muted-foreground)]">Materials</p>
                    <ul className="space-y-1">
                      {myPlan.materials.map((m) => (
                        <li key={m.id} className="flex items-center gap-1.5 text-sm">
                          <FileText className="h-3.5 w-3.5 text-[var(--primary)]" /> {m.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">No active plan</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
