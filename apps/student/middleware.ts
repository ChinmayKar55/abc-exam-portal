import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_PATHS = ["/", "/login", "/register", "/verify-email", "/forgot-password", "/reset-password"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths and Next.js internals through
  if (PUBLIC_PATHS.some((p) => p === "/" ? pathname === "/" : pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Read the persisted Zustand store from localStorage via the cookie mirror
  // The store is persisted to localStorage — not available server-side.
  // We use a lightweight cookie ("abc-auth-token") set by the client as the
  // server-side signal. If it's absent we redirect to login.
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
