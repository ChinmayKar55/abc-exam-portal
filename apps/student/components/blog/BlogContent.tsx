import { resolveAssetUrl } from "@/lib/utils"

// Matches a standalone markdown image block, e.g. ![alt text](/uploads/blogs/x.jpg)
const IMAGE_RE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/

function isSafeImageSrc(src: string): boolean {
  return src.startsWith("/") || /^https:\/\//i.test(src) || /^http:\/\/localhost/i.test(src)
}

/** Renders blog `content` (plain text with lightweight markdown-style
 * conventions) into HTML. Shared logic between the public blog post page
 * and the admin editor's live preview — keep both in sync when extending. */
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
              className="w-full max-w-3xl rounded-2xl shadow-md mx-auto my-8 block"
            />
          )
        }

        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={idx} className="text-2xl font-bold text-slate-900 mt-8 mb-4">
              {trimmed.replace(/^#\s*/, "")}
            </h2>
          )
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={idx} className="text-xl font-bold text-slate-900 mt-6 mb-3">
              {trimmed.replace(/^##\s*/, "")}
            </h3>
          )
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <ul key={idx} className="list-disc pl-6 space-y-2 marker:text-sky-600">
              {trimmed.split("\n").map((line, li) => (
                <li key={li}>{line.replace(/^[-*]\s*/, "")}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={idx} className="leading-8">
            {trimmed}
          </p>
        )
      })}
    </>
  )
}
