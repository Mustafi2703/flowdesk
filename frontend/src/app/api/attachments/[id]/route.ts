import { NextRequest } from 'next/server'
import { proxy } from '@/lib/api'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return proxy(req, { to: `/api/v1/attachments/${id}/download` })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return proxy(req, { to: `/api/v1/attachments/${id}` })
}
