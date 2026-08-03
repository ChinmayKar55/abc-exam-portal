"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, FileText } from "lucide-react"
import { blogQueries, type Blog } from "@/lib/queries/blogs"
import { formatDate } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

export default function BlogsPage() {
  const { data: blogs = [], isLoading } = useQuery({
    queryKey: ["blogs"],
    queryFn: blogQueries.list,
  })

  return (
    <main className="min-h-screen bg-[#f0f9ff]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Latest Updates & Exam Insights
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Preparation tips, syllabus breakdowns, and official announcements for OSSSC Nursing Officer aspirants.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        ) : blogs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm">
            <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900">No posts yet</h2>
            <p className="text-slate-500 mt-2">Check back soon for new articles.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {blogs.map((blog) => (
              <BlogCard key={blog.id} blog={blog} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function BlogCard({ blog }: { blog: Blog }) {
  return (
    <Link
      href={`/blogs/${blog.slug}`}
      className="group block bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
          <FileText className="h-7 w-7" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-600 mb-1">
            {formatDate(blog.created_at)}
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 group-hover:text-sky-700 transition-colors mb-2">
            {blog.title}
          </h2>
          {blog.subtitle && (
            <p className="text-slate-600 line-clamp-2">{blog.subtitle}</p>
          )}
        </div>
        <div className="shrink-0">
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-sky-600 group-hover:gap-2 transition-all">
            Read <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  )
}
