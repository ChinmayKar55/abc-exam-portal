"use client"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { Fragment, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  isLoading?: boolean
  searchKey?: string
  searchPlaceholder?: string
  pageSize?: number
  className?: string
  expandable?: boolean
  renderExpandedRow?: (row: T) => React.ReactNode
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  searchKey,
  searchPlaceholder = "Search…",
  pageSize = 10,
  className,
  expandable = false,
  renderExpandedRow,
}: DataTableProps<T>) {
  const [globalFilter, setGlobalFilter] = useState("")
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const isExpandable = expandable && !!renderExpandedRow

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
  })

  return (
    <div className={cn("space-y-3", className)}>
      {searchKey && (
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      <div className="rounded-[var(--radius)] border border-[var(--border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--muted)]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-[var(--border)] bg-[var(--card)]">
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <tr key={i}>
                  {columns.map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-[var(--muted-foreground)]">
                  No results found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const isExpanded = isExpandable && expandedRowId === row.id
                const firstColumnId = row.getVisibleCells()[0]?.column.id
                return (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() =>
                        isExpandable &&
                        setExpandedRowId(isExpanded ? null : row.id)
                      }
                      className={cn(
                        "hover:bg-[var(--secondary)] transition-colors",
                        isExpandable && "cursor-pointer",
                        isExpanded && "bg-[var(--secondary)]"
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isExpandable && cell.column.id === firstColumnId && (
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform",
                                  !isExpanded && "-rotate-90"
                                )}
                              />
                            )}
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        </td>
                      ))}
                    </tr>
                    {isExpanded && renderExpandedRow && (
                      <tr className="bg-[var(--secondary)]/50">
                        <td colSpan={columns.length} className="px-4 py-4">
                          {renderExpandedRow(row.original)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between text-sm text-[var(--muted-foreground)]">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
