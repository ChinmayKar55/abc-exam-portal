"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, CalendarDays, FileText, Newspaper } from "lucide-react"
import { blogQueries, type Blog } from "@/lib/queries/blogs"
import { formatDate } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

export default function BlogsPage() {
  const { data: blogs = [], isLoading } = useQuery({
    queryKey: ["blogs"],
    queryFn: blogQueries.list,
  })

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 text-white">
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-20 sm:pt-40 sm:pb-28 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-1.5 text-sm font-semibold mb-6">
              <Newspaper className="h-4 w-4" />
              Exam Updates
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-5">
              Latest Updates & Exam Insights
            </h1>
            <p className="text-lg sm:text-xl text-white/85 max-w-2xl leading-relaxed">
              Preparation tips, syllabus breakdowns, and official announcements curated for OSSSC Nursing Officer aspirants.
            </p>
          </div>
        </div>
      </section>

      {/* Listing */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-72 w-full rounded-2xl" />
            ))}
          </div>
        ) : blogs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-slate-100">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-sky-300 mb-5">
              <FileText className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">No posts yet</h2>
            <p className="text-slate-500 mt-2 max-w-md mx-auto">Check back soon for fresh articles on exam patterns, preparation strategies, and important updates.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogs.map((blog, idx) => (
              <BlogCard key={blog.id} blog={blog} featured={idx === 0} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function BlogCard({ blog, featured }: { blog: Blog; featured?: boolean }) {
  return (
    <Link
      href={`/blogs/${blog.slug}`}
      className={`
        group flex flex-col h-full bg-white rounded-2xl border border-slate-100 shadow-sm
        transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-sky-100
        ${featured ? "md:col-span-2 lg:col-span-1" : ""}
      `}
    >
      <div className="h-3 bg-gradient-to-r from-sky-500 to-blue-600 rounded-t-2xl" />
      <div className="flex-1 p-6 sm:p-7 flex flex-col">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-600 mb-4">
          <CalendarDays className="h-3.5 w-3.5" />
          <span>{formatDate(blog.created_at)}</span>
        </div>

        <h2 className="text-xl font-bold text-slate-900 mb-3 line-clamp-2 group-hover:text-sky-700 transition-colors">
          {blog.title}
        </h2>

        {blog.subtitle && (
          <p className="text-slate-600 line-clamp-3 mb-6 flex-1 leading-relaxed">
            {blog.subtitle}
          </p>
        )}

        <div className="mt-auto flex items-center gap-2 text-sm font-bold text-sky-600 group-hover:gap-3 transition-all">
          Read article
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  )
}
