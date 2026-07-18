import { NextRequest } from 'next/server'
import { proxy } from '@/lib/api'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxy(req, { to: `/api/v1/brands/${id}/logo` })
}
