"use client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useEffect } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Plus, Save, Pencil, Trash2 } from "lucide-react"
import { DataTable } from "@/components/shared/DataTable"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { planQueries, type Plan, type CreatePlanInput } from "@/lib/queries/plans"
import { examQueries, type Exam } from "@/lib/queries/exams"
import { formatCurrency, formatDate } from "@/lib/utils"

const columns = (onEdit: (p: Plan) => void, onDelete: (id: string) => void): ColumnDef<Plan>[] => [
  { accessorKey: "name", header: "Plan", cell: ({ row }) => <span className="font-medium text-sm">{row.original.name}</span> },
  { accessorKey: "description", header: "Description", cell: ({ row }) => <span className="text-sm text-[var(--muted-foreground)]">{row.original.description}</span> },
  { accessorKey: "price_paise", header: "Price", cell: ({ row }) => <span className="font-mono font-semibold text-sm">{formatCurrency(row.original.price_paise)}</span> },
  { accessorKey: "exams", header: "Exams", cell: ({ row }) => <Badge variant="ocean">{row.original.exams?.length ?? 0}</Badge> },
  { accessorKey: "materials", header: "Materials", cell: ({ row }) => <Badge variant="brand">{row.original.materials?.length ?? 0}</Badge> },
  {
    accessorKey: "active",
    header: "Status",
    cell: ({ row }) => (
      row.original.active
        ? <Badge variant="success">Active</Badge>
        : <Badge variant="secondary">Inactive</Badge>
    ),
  },
  { accessorKey: "created_at", header: "Created", cell: ({ row }) => <span className="text-xs text-[var(--muted-foreground)]">{formatDate(row.original.created_at)}</span> },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => onEdit(row.original)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => onDelete(row.original.id)}>
          <Trash2 className="h-4 w-4 text-[color:var(--color-danger-500)]" />
        </Button>
      </div>
    ),
  },
]

const DEFAULT_FORM: CreatePlanInput = {
  name: "",
  description: "",
  price_paise: 0,
  active: true,
  exam_ids: [],
  material_ids: [],
}

export default function PlansPage() {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreatePlanInput>(DEFAULT_FORM)

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: planQueries.list,
  })

  const { data: exams = [] } = useQuery({
    queryKey: ["admin-exams"],
    queryFn: examQueries.list,
  })

  const { data: materials = [] } = useQuery({
    queryKey: ["study-materials"],
    queryFn: planQueries.materials,
  })

  useEffect(() => {
    if (!dialogOpen) {
      setEditingId(null)
      setForm(DEFAULT_FORM)
    }
  }, [dialogOpen])

  const createMutation = useMutation({
    mutationFn: () => planQueries.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-plans"] }); setDialogOpen(false) },
  })

  const updateMutation = useMutation({
    mutationFn: () => planQueries.update(editingId!, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-plans"] }); setDialogOpen(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => planQueries.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-plans"] }),
  })

  const handleEdit = (p: Plan) => {
    setEditingId(p.id)
    setForm({
      name: p.name,
      description: p.description,
      price_paise: p.price_paise,
      active: p.active,
      exam_ids: p.exams?.map((e) => e.id) ?? [],
      material_ids: p.materials?.map((m) => m.id) ?? [],
    })
    setDialogOpen(true)
  }

  const toggleSelection = (id: string, list: string[]) => {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        description={`${plans.length} plans configured`}
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Create Plan
          </Button>
        }
      />
      <DataTable
        columns={columns(handleEdit, (id) => deleteMutation.mutate(id))}
        data={plans}
        isLoading={isLoading}
        searchKey="name"
        searchPlaceholder="Search plans…"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Plan" : "Create Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Price (paise)</Label>
                <Input type="number" min={0} value={form.price_paise} onChange={(e) => setForm((f) => ({ ...f, price_paise: Number(e.target.value) }))} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  id="active"
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="h-4 w-4"
                />
                <Label htmlFor="active" className="cursor-pointer">Active</Label>
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block">Exams</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-[var(--radius)] border border-[var(--border)] p-3">
                {exams.map((e: Exam) => (
                  <label key={e.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.exam_ids.includes(e.id)}
                      onChange={() => setForm((f) => ({ ...f, exam_ids: toggleSelection(e.id, f.exam_ids) }))}
                      className="h-4 w-4"
                    />
                    <span className="truncate">{e.title}</span>
                  </label>
                ))}
                {exams.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">No active exams available.</p>}
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block">Study Materials</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-[var(--radius)] border border-[var(--border)] p-3">
                {materials.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.material_ids.includes(m.id)}
                      onChange={() => setForm((f) => ({ ...f, material_ids: toggleSelection(m.id, f.material_ids) }))}
                      className="h-4 w-4"
                    />
                    <span className="truncate">{m.title}</span>
                  </label>
                ))}
                {materials.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">No materials available.</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!form.name.trim() || (editingId ? updateMutation.isPending : createMutation.isPending)}
              onClick={() => editingId ? updateMutation.mutate() : createMutation.mutate()}
            >
              <Save className="h-4 w-4" /> {editingId ? "Update Plan" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
