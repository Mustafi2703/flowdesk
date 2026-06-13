import { NextRequest, NextResponse } from 'next/server'
import { proxy } from '@/lib/api'

export async function GET(req: NextRequest) {
  if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return proxy(req, {
    to: '/api/v1/cron/daily-digests',
    method: 'POST',
    extraHeaders: { 'x-cron-secret': process.env.CRON_SECRET || '' },
  })
}
