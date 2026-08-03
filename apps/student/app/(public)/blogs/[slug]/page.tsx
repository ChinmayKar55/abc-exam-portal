"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, CalendarDays } from "lucide-react"
import { blogQueries } from "@/lib/queries/blogs"
import { formatDate } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

export default function BlogDetailPage() {
  const params = useParams<{ slug: string }>()
  const slug = decodeURIComponent(params.slug ?? "")

  const { data: blog, isLoading, error } = useQuery({
    queryKey: ["blog", slug],
    queryFn: () => blogQueries.getBySlug(slug),
    enabled: !!slug,
  })

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f0f9ff] py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-32 mb-8" />
          <Skeleton className="h-12 w-full mb-4" />
          <Skeleton className="h-6 w-2/3 mb-8" />
          <div className="space-y-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </main>
    )
  }

  if (error || !blog) {
    return (
      <main className="min-h-screen bg-[#f0f9ff] py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Post not found</h1>
          <p className="text-slate-600 mb-8">The article you are looking for does not exist or has been removed.</p>
          <Button asChild variant="outline">
            <Link href="/blogs">← Back to blogs</Link>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f0f9ff]">
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <Link
          href="/blogs"
          className="inline-flex items-center gap-2 text-sm font-medium text-sky-700 hover:text-sky-900 mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Back to blogs
        </Link>

        <header className="mb-10">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
            <CalendarDays className="h-4 w-4" />
            <time dateTime={blog.created_at}>{formatDate(blog.created_at)}</time>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight mb-5">
            {blog.title}
          </h1>
          {blog.subtitle && (
            <p className="text-xl text-slate-600 leading-relaxed">{blog.subtitle}</p>
          )}
        </header>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-10">
          <div className="prose prose-slate max-w-none">
            {blog.content.split("\n\n").map((paragraph, idx) => (
              <p key={idx} className="text-slate-700 leading-8 text-lg mb-6 last:mb-0">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </article>
    </main>
  )
}
