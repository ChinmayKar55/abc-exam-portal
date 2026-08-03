import { resolveAssetUrl } from "@/lib/utils"

// Matches a standalone markdown image block, e.g. ![alt text](/uploads/blogs/x.jpg)
const IMAGE_RE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/

function isSafeImageSrc(src: string): boolean {
  return src.startsWith("/") || /^https:\/\//i.test(src) || /^http:\/\/localhost/i.test(src)
}

/** Renders blog `content` (plain text with lightweight markdown-style
 * conventions) into HTML. Mirrors the student app's BlogContent component
 * (apps/student/components/blog/BlogContent.tsx) so the admin preview
 * matches the public blog post rendering exactly — keep both in sync when
 * extending. Duplicated rather than shared because admin and student are
 * independent Next.js apps with no shared workspace package. */
export function BlogContent({ content }: { content: string }) {
  return (
    <>
      {content.split("\n\n").map((paragraph, idx) => {
        const trimmed = paragraph.trim()
        if (!trimmed) return null

        const imageMatch = trimmed.match(IMAGE_RE)
        if (imageMatch) {
          const [, alt, src] = imageMatch
          if (!isSafeImageSrc(src)) return null
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={idx}
              src={resolveAssetUrl(src)}
              alt={alt || ""}
              loading="lazy"
              className="w-full max-w-md rounded-lg shadow-sm mx-auto my-4 block"
            />
          )
        }

        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={idx} className="text-xl font-bold text-slate-900 mt-6 mb-3">
              {trimmed.replace(/^#\s*/, "")}
            </h2>
          )
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={idx} className="text-lg font-bold text-slate-900 mt-5 mb-2">
              {trimmed.replace(/^##\s*/, "")}
            </h3>
          )
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <ul key={idx} className="list-disc pl-6 space-y-1 marker:text-[var(--primary)]">
              {trimmed.split("\n").map((line, li) => (
                <li key={li}>{line.replace(/^[-*]\s*/, "")}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={idx} className="leading-7">
            {trimmed}
          </p>
        )
      })}
    </>
  )
}
