import { NextResponse } from 'next/server'

// The file-cleanup cron stub from the original prototype is kept here for
// route compatibility but performs no work in the FastAPI-backed demo.
// The backend handles file lifecycle itself.
export async function GET() {
  return NextResponse.json({ ok: true, deleted: 0 })
}
