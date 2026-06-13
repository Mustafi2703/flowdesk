import { NextRequest } from 'next/server'
import { proxy } from '@/lib/api'

export async function GET(req: NextRequest) {
  return proxy(req, { to: '/api/v1/team' })
}

export async function POST(req: NextRequest) {
  return proxy(req, { to: '/api/v1/team' })
}
