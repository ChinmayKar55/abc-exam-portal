"use client"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/DataTable"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { PageHeader } from "@/components/shared/PageHeader"
import { Badge } from "@/components/ui/badge"
import { adminQueries, type AdminUser } from "@/lib/queries/admin"
import { formatDate } from "@/lib/utils"

const columns: ColumnDef<AdminUser>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-sm">{row.original.name}</p>
        <p className="text-xs text-[var(--muted-foreground)]">{row.original.email}</p>
      </div>
    ),
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => (
      <Badge variant={row.original.role === "admin" ? "default" : "secondary"} className="capitalize">
        {row.original.role}
      </Badge>
    ),
  },
  {
    accessorKey: "email_verified",
    header: "Verified",
    cell: ({ row }) => (
      row.original.email_verified
        ? <Badge variant="success">Verified</Badge>
        : <Badge variant="warning">Pending</Badge>
    ),
  },
  {
    accessorKey: "plan_name",
    header: "Plan",
    cell: ({ row }) => (
      row.original.plan_name
        ? <div><p className="text-sm font-medium">{row.original.plan_name}</p><StatusBadge status={row.original.plan_active ? "published" : "failed"} /></div>
        : <span className="text-xs text-[var(--muted-foreground)]">No plan</span>
    ),
  },
  {
    accessorKey: "created_at",
    header: "Joined",
    cell: ({ row }) => <span className="text-xs text-[var(--muted-foreground)]">{formatDate(row.original.created_at)}</span>,
  },
]

export default function UsersPage() {
  const [page] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", page],
    queryFn: () => adminQueries.users(page),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={data?.meta ? `${data.meta.total} total users` : "All registered users"}
      />
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        searchKey="name"
        searchPlaceholder="Search by name or email…"
        pageSize={20}
      />
    </div>
  )
}
