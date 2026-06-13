/**
 * Frontend → FastAPI proxy helpers.
 *
 * Every Next.js API route in this project is now a thin forwarder that
 * passes the user's request along to the Python FastAPI backend with the
 * session cookie intact. Both servers verify the same JWT_SECRET / sf_sess
 * cookie, so authorization stays consistent across both layers.
 *
 * Why a proxy rather than calling FastAPI directly from client components?
 * Because the original frontend ships with relative `/api/...` paths and a
 * Next.js middleware that protects pages. Keeping the API surface stable
 * means we don't have to rewrite every component.
 */

import { NextRequest, NextResponse } from 'next/server'

const API_BASE =
  process.env.FASTAPI_BASE_URL ||
  process.env.NEXT_PUBLIC_FASTAPI_BASE_URL ||
  'http://127.0.0.1:8000'

const COOKIE = 'sf_sess'

type ProxyOptions = {
  /** Custom path on the FastAPI side, including the /api/v1 prefix. */
  to: string
  /** Override the upstream method. Defaults to the incoming method. */
  method?: string
  /** Forward query params (default true). */
  forwardQuery?: boolean
  /** Forward request body (default true for non-GET). */
  forwardBody?: boolean
  /** Extra headers to add to the upstream request. */
  extraHeaders?: Record<string, string>
}

export async function proxy(req: NextRequest, opts: ProxyOptions): Promise<NextResponse> {
  const url = new URL(opts.to.startsWith('http') ? opts.to : `${API_BASE}${opts.to}`)
  if (opts.forwardQuery !== false) {
    const incoming = new URL(req.url)
    incoming.searchParams.forEach((v, k) => url.searchParams.set(k, v))
  }

  const method = (opts.method || req.method || 'GET').toUpperCase()
  const headers: Record<string, string> = {
    'content-type': req.headers.get('content-type') || 'application/json',
    'accept': 'application/json',
    ...(opts.extraHeaders || {}),
  }

  const token = req.cookies.get(COOKIE)?.value
  if (token) {
    headers['authorization'] = `Bearer ${token}`
    headers['cookie'] = `${COOKIE}=${token}`
  }

  let body: BodyInit | undefined
  if (opts.forwardBody !== false && method !== 'GET' && method !== 'HEAD') {
    const raw = await req.text()
    if (raw) body = raw
  }

  const upstream = await fetch(url.toString(), { method, headers, body, cache: 'no-store' })
  const text = await upstream.text()
  const res = new NextResponse(text || null, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') || 'application/json' },
  })
  // Mirror any Set-Cookie headers so login/logout work transparently.
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') res.headers.append('set-cookie', value)
  })
  return res
}

export const API_BASE_URL = API_BASE
