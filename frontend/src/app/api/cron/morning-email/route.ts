import { NextRequest, NextResponse } from 'next/server'
import { proxy } from '@/lib/api'

/** Morning brief — 9:00 IST weekdays (3:30 UTC). */
export async function GET(req: NextRequest) {
  if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return proxy(req, {
    to: '/api/v1/cron/morning-digests',
    method: 'POST',
    extraHeaders: { 'x-cron-secret': process.env.CRON_SECRET || '' },
  })
}
