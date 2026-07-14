import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-8xl font-black text-gradient">404</p>
        <h2 className="text-2xl font-bold">Page not found</h2>
        <p className="text-sm text-[var(--muted-foreground)] max-w-xs">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
