import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import type { SessionUser } from '@/types'

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

export async function requireRole(
  allowed: (role: string) => boolean,
  fallback = '/overview',
): Promise<SessionUser> {
  const session = await requireSession()
  if (!allowed(session.role)) redirect(fallback)
  return session
}
