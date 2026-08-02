import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_PATHS = ["/login", "/register", "/verify-email", "/forgot-password", "/reset-password"]

function isStaticPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname === "/favicon.ico" ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|otf|mp4|mp3|pdf)$/.test(pathname)
  )
}

function hostName(request: NextRequest): string {
  const header = request.headers.get("host") ?? ""
  return header.split(":")[0]
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = hostName(request)

  if (isStaticPath(pathname)) {
    return NextResponse.next()
  }

  // Apex domain: only the landing page is served here.
  // Everything else (including auth pages) belongs on student.osssc.online.
  if (host === "osssc.online" || host === "www.osssc.online") {
    if (pathname === "/") {
      return NextResponse.next()
    }
    const target = request.nextUrl.clone()
    target.protocol = "https"
    target.port = ""
    target.host = "student.osssc.online"
    return NextResponse.redirect(target)
  }

  // Student portal: root should not repeat the landing page.
  // Send authenticated users to dashboard, everyone else to login.
  if ((host === "student.osssc.online" || host === "localhost") && pathname === "/") {
    const token = request.cookies.get("abc-auth-token")?.value
    const target = request.nextUrl.clone()
    target.pathname = token ? "/dashboard" : "/login"
    return NextResponse.redirect(target)
  }

  // Auth protection for non-public paths.
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = request.cookies.get("abc-auth-token")?.value
  if (!token) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico
     * - /api routes (rewrites)
     * - Static file extensions (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|otf|mp4|mp3|pdf)).*)",
  ],
}
