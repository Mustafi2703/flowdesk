import { NextRequest } from 'next/server'
import { proxy } from '@/lib/api'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  // Close only — never purge/delete chat history.
  return proxy(req, { to: `/api/v1/tasks/${id}/updates/close?purge=false`, method: 'POST' })
}
