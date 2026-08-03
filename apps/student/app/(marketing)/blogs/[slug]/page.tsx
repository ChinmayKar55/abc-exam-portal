"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, CalendarDays, Clock, FileText } from "lucide-react"
import { blogQueries } from "@/lib/queries/blogs"
import { formatDate } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { BlogContent } from "@/components/blog/BlogContent"

export default function BlogDetailPage() {
  const params = useParams<{ slug: string }>()
  const slug = decodeURIComponent(params.slug ?? "")

  const { data: blog, isLoading, error } = useQuery({
    queryKey: ["blog", slug],
    queryFn: () => blogQueries.getBySlug(slug),
    enabled: !!slug,
  })

  if (isLoading) {
    return <BlogSkeleton />
  }

  if (error || !blog) {
    return (
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-sky-300 mb-6">
          <FileText className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Post not found</h1>
        <p className="text-slate-600 mb-8 max-w-md mx-auto">
          The article you are looking for does not exist or may have been removed.
        </p>
        <Button asChild variant="outline" className="rounded-full px-6">
          <Link href="/blogs">← Back to blogs</Link>
        </Button>
      </section>
    )
  }

  const readingTime = Math.max(1, Math.ceil(blog.content.split(/\s+/).length / 200))

  return (
    <>
      {/* Subtle top accent */}
      <div className="h-2 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-700" />

      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16 sm:pt-36 sm:pb-20">
        <Link
          href="/blogs"
          className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-900 hover:gap-3 transition-all mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Back to blogs
        </Link>

        <header className="mb-10">
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-5">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              <time dateTime={blog.created_at}>{formatDate(blog.created_at)}</time>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {readingTime} min read
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight mb-5 leading-tight">
            {blog.title}
          </h1>

          {blog.subtitle && (
            <p className="text-xl text-slate-600 leading-relaxed">{blog.subtitle}</p>
          )}
        </header>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 sm:p-10 lg:p-12">
          <div className="text-slate-700 text-lg leading-8 space-y-6">
            <BlogContent content={blog.content} />
          </div>
        </div>

        <div className="mt-12 flex justify-center">
          <Button asChild variant="outline" className="rounded-full px-8">
            <Link href="/blogs">← Browse more articles</Link>
          </Button>
        </div>
      </article>
    </>
  )
}

function BlogSkeleton() {
  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <Skeleton className="h-5 w-32 mb-8" />
      <Skeleton className="h-6 w-48 mb-5" />
      <Skeleton className="h-12 w-full mb-4" />
      <Skeleton className="h-6 w-2/3 mb-10" />
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 sm:p-10 lg:p-12 space-y-5">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    </article>
  )
}
