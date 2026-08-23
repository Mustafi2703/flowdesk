import { proxy } from '@/lib/proxy'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  return proxy(req, { to: '/api/v1/emails/morning-digest', method: 'POST' })
}
