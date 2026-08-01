import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatScore(score: number | null | undefined): string {
  if (score == null) return "—"
  return `${score.toFixed(1)}%`
}

export function formatCurrency(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function calculateGST(basePaise: number, taxRate = 18): number {
  return Math.round(basePaise * taxRate / 100)
}

export function calculateTotal(basePaise: number, taxRate = 18): number {
  return basePaise + calculateGST(basePaise, taxRate)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso))
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Exit fullscreen in the current document and, if accessible, any parent
 * documents (e.g. when the app is rendered inside an iframe preview).
 */
export async function exitFullscreen(): Promise<void> {
  const exits: Promise<void>[] = []
  let doc: Document | null = document

  while (doc) {
    if (doc.fullscreenElement) {
      const d = doc as Document & {
        webkitExitFullscreen?: () => Promise<void> | void
        msExitFullscreen?: () => Promise<void> | void
        mozCancelFullScreen?: () => Promise<void> | void
      }
      const fn =
        doc.exitFullscreen ??
        d.webkitExitFullscreen ??
        d.mozCancelFullScreen ??
        d.msExitFullscreen
      if (fn) {
        exits.push(
          Promise.resolve()
            .then(() => fn.call(doc))
            .catch(() => {})
        )
      }
    }

    try {
      const parentDoc: Document | undefined = doc.defaultView?.parent?.document
      if (!parentDoc || parentDoc === doc) break
      doc = parentDoc
    } catch {
      // Cross-origin parent — stop traversal.
      break
    }
  }

  await Promise.all(exits)
}

export function formatDurationLabel(days: number): string {
  if (days <= 0) return "forever"
  if (days % 365 === 0) return `${days / 365} year${days / 365 === 1 ? "" : "s"}`
  if (days % 30 === 0) return `${days / 30} month${days / 30 === 1 ? "" : "s"}`
  if (days < 30) return `${days} day${days === 1 ? "" : "s"}`
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? "" : "s"}`
}
