import { NextRequest } from 'next/server'
import { proxy } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return proxy(req, { to: '/api/v1/attachments' })
}

export async function POST(req: NextRequest) {
  // Stream multipart so large files are not truncated by the default 10MB buffer.
  return proxy(req, { to: '/api/v1/attachments', streamBody: true })
}
