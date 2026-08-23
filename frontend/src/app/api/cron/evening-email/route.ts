import { NextRequest, NextResponse } from 'next/server'
import { proxy } from '@/lib/api'

/** Evening brief — pending tasks & timelines (~18:30 IST = 13:00 UTC). */
export async function GET(req: NextRequest) {
  if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return proxy(req, {
    to: '/api/v1/cron/evening-digests',
    method: 'POST',
    extraHeaders: { 'x-cron-secret': process.env.CRON_SECRET || '' },
  })
}
