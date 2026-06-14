import { NextRequest, NextResponse } from 'next/server'

const PUBLIC = ['/login', '/api/auth/login', '/api/auth/logout', '/api/auth/demo-login']
const COOKIE = 'sf_sess'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname.startsWith('/_next') || pathname.includes('.')) return NextResponse.next()

  // Middleware runs in the Edge runtime, where the Node `jsonwebtoken`
  // package is not reliable. Keep middleware lightweight: require the
  // HttpOnly session cookie, then let the server layout and FastAPI perform
  // the real JWT + RBAC checks.
  const hasSessionCookie = Boolean(req.cookies.get(COOKIE)?.value)
  if (!hasSessionCookie) {
    const url = new URL('/login', req.url)
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
