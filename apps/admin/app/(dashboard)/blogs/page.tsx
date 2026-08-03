"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { DataTable } from "@/components/shared/DataTable"
import { PageHeader } from "@/components/shared/PageHeader"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { blogQueries, type Blog, type CreateBlogInput } from "@/lib/queries/blogs"
import { formatDate } from "@/lib/utils"

const DEFAULT_FORM: CreateBlogInput = {
  title: "",
  subtitle: "",
  content: "",
  published: false,
}

const columns = (
  onEdit: (blog: Blog) => void,
  onDelete: (id: string) => void
): ColumnDef<Blog>[] => [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => <span className="font-medium text-sm">{row.original.title}</span>,
  },
  {
    accessorKey: "subtitle",
    header: "Subtitle",
    cell: ({ row }) => (
      <span className="text-sm text-[var(--muted-foreground)] truncate max-w-md block">
        {row.original.subtitle || "—"}
      </span>
    ),
  },
  {
    accessorKey: "published",
    header: "Status",
    cell: ({ row }) =>
      row.original.published ? (
        <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">Published</Badge>
      ) : (
        <Badge variant="secondary">Draft</Badge>
      ),
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => <span className="text-sm whitespace-nowrap">{formatDate(row.original.created_at)}</span>,
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-1">
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

export default function BlogsPage() {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateBlogInput>(DEFAULT_FORM)

  const { data: blogs = [], isLoading } = useQuery({
    queryKey: ["admin-blogs"],
    queryFn: blogQueries.list,
  })

  const createMutation = useMutation({
    mutationFn: () => blogQueries.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-blogs"] })
      setDialogOpen(false)
      setForm(DEFAULT_FORM)
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => blogQueries.update(editingId!, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-blogs"] })
      setDialogOpen(false)
      setEditingId(null)
      setForm(DEFAULT_FORM)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => blogQueries.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-blogs"] })
      setDeleteId(null)
    },
  })

  const handleEdit = (blog: Blog) => {
    setEditingId(blog.id)
    setForm({
      title: blog.title,
      subtitle: blog.subtitle,
      content: blog.content,
      published: blog.published,
    })
    setDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingId(null)
    setForm(DEFAULT_FORM)
    setDialogOpen(true)
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const canSubmit = form.title.trim() && form.content.trim()

  const deleteBlog = useMemo(() => blogs.find((b) => b.id === deleteId), [blogs, deleteId])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blogs"
        description={`${blogs.length} blog post${blogs.length !== 1 ? "s" : ""}`}
        action={
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4" /> Create Blog
          </Button>
        }
      />

      <DataTable
        columns={columns(handleEdit, setDeleteId)}
        data={blogs}
        isLoading={isLoading}
        searchKey="title"
        searchPlaceholder="Search blogs…"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Blog Post" : "Create Blog Post"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. OSSSC Nursing Officer Exam Pattern 2026"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subtitle">Subtitle</Label>
              <Input
                id="subtitle"
                value={form.subtitle}
                onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                placeholder="Short one-line summary"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="content">Content</Label>
              <textarea
                id="content"
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Write the full blog post here..."
                rows={12}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm shadow-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
                className="h-4 w-4"
              />
              Publish immediately
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!canSubmit || isPending}
              onClick={() => (editingId ? updateMutation.mutate() : createMutation.mutate())}
            >
              {isPending ? "Saving…" : editingId ? "Update Post" : "Create Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null) }}
        title="Delete blog post"
        description={`Are you sure you want to delete "${deleteBlog?.title ?? "this post"}"? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteId) deleteMutation.mutate(deleteId)
          setDeleteId(null)
        }}
      />
    </div>
  )
}
