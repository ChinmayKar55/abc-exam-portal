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

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081/api").replace(/\/api\/?$/, "")

/** Resolves a relative asset path (e.g. "/uploads/blogs/xyz.jpg") returned by
 * the API into an absolute URL pointing at the API's origin. Absolute URLs
 * (external images) are returned unchanged. */
export function resolveAssetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`
}
