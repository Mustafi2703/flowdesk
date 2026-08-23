import { proxy } from '@/lib/proxy'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params
  return proxy(req, { to: `/api/v1/emails/task-brief/${id}`, method: 'POST' })
}
