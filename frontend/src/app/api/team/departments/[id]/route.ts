import { NextRequest } from 'next/server'
import { proxy } from '@/lib/api'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return proxy(req, { to: `/api/v1/team/departments/${params.id}` })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return proxy(req, { to: `/api/v1/team/departments/${params.id}` })
}
