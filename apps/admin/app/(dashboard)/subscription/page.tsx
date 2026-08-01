"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Crown, Loader2, Save, Search } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { examQueries, type Exam } from "@/lib/queries/exams"
import { subscriptionQueries, type SubscriptionPlan } from "@/lib/queries/subscription"
import { formatCurrency, cn } from "@/lib/utils"

const TIER_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: "free", label: "Free", color: "bg-slate-100 text-slate-700" },
  { value: "pro", label: "Pro", color: "bg-amber-100 text-amber-700" },
  { value: "max", label: "Max", color: "bg-violet-100 text-violet-700" },
]

function TierCard({
  plan,
  draft,
  onChange,
  onSave,
  isSaving,
}: {
  plan: SubscriptionPlan
  draft: Partial<SubscriptionPlan>
  onChange: (v: Partial<SubscriptionPlan>) => void
  onSave: () => void
  isSaving: boolean
}) {
  const isFree = plan.tier === "free"
  const color =
    plan.tier === "free" ? "border-slate-200" :
    plan.tier === "pro" ? "border-amber-200" : "border-violet-200"

  return (
    <Card className={cn("border-2", color)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="capitalize flex items-center gap-2">
            <Crown className={cn("h-4 w-4", plan.tier === "max" && "text-violet-500", plan.tier === "pro" && "text-amber-500")} />
            {plan.tier}
          </CardTitle>
          <Badge className={cn("capitalize", TIER_OPTIONS.find((t) => t.value === plan.tier)?.color)}>
            {isFree ? "Lifetime" : `${draft.duration_days ?? plan.duration_days} days`}
          </Badge>
        </div>
        <CardDescription>{isFree ? "Available to every user" : "Paid subscription tier"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input
            value={draft.name ?? plan.name}
            disabled={isFree}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input
            value={draft.description ?? plan.description}
            disabled={isFree}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Price (₹)</Label>
            <Input
              type="number"
              min={0}
              value={Math.round((draft.price_paise ?? plan.price_paise) / 100)}
              disabled={isFree}
              onChange={(e) => onChange({ price_paise: Number(e.target.value) * 100 })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Duration (days)</Label>
            <Input
              type="number"
              min={isFree ? 0 : 1}
              value={draft.duration_days ?? plan.duration_days}
              disabled={isFree}
              onChange={(e) => onChange({ duration_days: Number(e.target.value) })}
            />
          </div>
        </div>
        {!isFree && (
          <Button onClick={onSave} disabled={isSaving} className="w-full">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <Save className="h-4 w-4 mr-2" /> Save {plan.tier} settings
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export default function SubscriptionAdminPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState("")

  const { data: tiers = [], isLoading: tiersLoading } = useQuery({
    queryKey: ["admin-subscription-tiers"],
    queryFn: subscriptionQueries.list,
  })

  const { data: exams = [], isLoading: examsLoading } = useQuery({
    queryKey: ["admin-exams"],
    queryFn: examQueries.list,
  })

  const [draftTiers, setDraftTiers] = useState<Record<string, Partial<SubscriptionPlan>>>({})
  const [examTiers, setExamTiers] = useState<Record<string, string>>({})

  // Initialise per-exam tier map from the exam list once it loads.
  useEffect(() => {
    if (exams.length && !Object.keys(examTiers).length) {
      const m: Record<string, string> = {}
      for (const e of exams) m[e.id] = e.access_tier
      setExamTiers(m)
    }
  }, [exams, examTiers])

  const updateTier = useMutation({
    mutationFn: ({ tier, data }: { tier: string; data: Partial<SubscriptionPlan> }) =>
      subscriptionQueries.update(tier, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-subscription-tiers"] }),
  })

  const bulkUpdate = useMutation({
    mutationFn: async (assignments: Record<string, string>) => {
      const byTier: Record<string, string[]> = { free: [], pro: [], max: [] }
      for (const [examId, tier] of Object.entries(assignments)) {
        if (byTier[tier]) byTier[tier].push(examId)
      }
      for (const [tier, examIds] of Object.entries(byTier)) {
        if (examIds.length) await subscriptionQueries.bulkTier({ exam_ids: examIds, access_tier: tier as any })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-exams"] })
    },
  })

  const handleTierChange = (tier: string, patch: Partial<SubscriptionPlan>) => {
    setDraftTiers((prev) => ({ ...prev, [tier]: { ...prev[tier], ...patch } }))
  }

  const saveTier = (tier: string) => {
    const plan = tiers.find((t) => t.tier === tier)
    if (!plan || tier === "free") return
    const draft = draftTiers[tier] || {}
    const payload: Partial<SubscriptionPlan> = {}
    if (draft.name !== undefined && draft.name !== plan.name) payload.name = draft.name
    if (draft.description !== undefined && draft.description !== plan.description) payload.description = draft.description
    if (draft.price_paise !== undefined && draft.price_paise !== plan.price_paise) payload.price_paise = draft.price_paise
    if (draft.duration_days !== undefined && draft.duration_days !== plan.duration_days) payload.duration_days = draft.duration_days
    if (Object.keys(payload).length) updateTier.mutate({ tier, data: payload })
  }

  const changedExamAssignments = () => {
    const changed: Record<string, string> = {}
    for (const e of exams) {
      if (examTiers[e.id] && examTiers[e.id] !== e.access_tier) {
        changed[e.id] = examTiers[e.id]
      }
    }
    return changed
  }

  const saveExamTiers = () => {
    const changed = changedExamAssignments()
    if (Object.keys(changed).length) bulkUpdate.mutate(changed)
  }

  const filteredExams = exams.filter((e) =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.description?.toLowerCase().includes(search.toLowerCase())
  )

  const changed = Object.keys(changedExamAssignments()).length

  return (
    <div className="space-y-8">
      <PageHeader title="Subscription" description="Manage tiers, validity, and exam access" />

      {tiersLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((t) => (
            <TierCard
              key={t.tier}
              plan={t}
              draft={draftTiers[t.tier] || {}}
              onChange={(patch) => handleTierChange(t.tier, patch)}
              onSave={() => saveTier(t.tier)}
              isSaving={updateTier.isPending}
            />
          ))}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold">Attach exams to tiers</h3>
          <Button onClick={saveExamTiers} disabled={!changed || bulkUpdate.isPending}>
            {bulkUpdate.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <Save className="h-4 w-4 mr-2" />
            Save {changed ? `(${changed})` : ""} exam assignments
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input
            className="pl-10"
            placeholder="Search exams…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--secondary)] text-[var(--muted-foreground)]">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Title</th>
                <th className="text-left px-4 py-3 font-medium w-28">Type</th>
                <th className="text-left px-4 py-3 font-medium w-40">Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {examsLoading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredExams.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                    No exams found
                  </td>
                </tr>
              ) : (
                filteredExams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-[var(--secondary)]/40">
                    <td className="px-4 py-3">
                      <p className="font-medium">{exam.title}</p>
                      <p className="text-xs text-[var(--muted-foreground)] line-clamp-1">{exam.description}</p>
                    </td>
                    <td className="px-4 py-3 capitalize">
                      <Badge variant="brand">{exam.exam_type}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="h-9 w-full rounded-[var(--radius)] border border-[var(--input)] bg-transparent px-2 text-sm"
                        value={examTiers[exam.id] ?? exam.access_tier}
                        onChange={(e) => setExamTiers((prev) => ({ ...prev, [exam.id]: e.target.value }))}
                      >
                        {TIER_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
