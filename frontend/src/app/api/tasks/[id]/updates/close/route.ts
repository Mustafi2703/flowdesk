import { NextRequest } from 'next/server'
import { proxy } from '@/lib/api'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const purge = req.nextUrl.searchParams.get('purge')
  const q = purge != null ? `?purge=${purge}` : '?purge=true'
  return proxy(req, { to: `/api/v1/tasks/${id}/updates/close${q}`, method: 'POST' })
}
