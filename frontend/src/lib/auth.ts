import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { SessionUser } from '@/types'

const SECRET = process.env.JWT_SECRET || 'scrumfolks-dev-secret-change-in-prod'
const COOKIE = 'sf_sess'

export async function hashPassword(p: string) { return bcrypt.hash(p, 10) }
export async function verifyPassword(p: string, h: string) { return bcrypt.compare(p, h) }

export function signToken(u: SessionUser) { return jwt.sign(u, SECRET, { expiresIn: '7d' }) }
export function verifyToken(t: string): SessionUser | null {
  try { return jwt.verify(t, SECRET) as SessionUser } catch { return null }
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  return token ? verifyToken(token) : null
}

export function getSessionFromRequest(req: NextRequest): SessionUser | null {
  const token = req.cookies.get(COOKIE)?.value
  return token ? verifyToken(token) : null
}

export function setSessionCookie(res: NextResponse, u: SessionUser) {
  const token = signToken(u)
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE, '', { maxAge: 0, path: '/' })
}

export const canManage       = (r: string) => ['owner','manager'].includes(r)
export const canViewBilling  = (r: string) => ['owner','manager','accountant'].includes(r)
export const canEditBilling  = (r: string) => ['owner','accountant'].includes(r)
export const canSetTaskPrice = (r: string) => ['owner','manager','accountant'].includes(r)
export const canApproveLeave = (r: string) => ['owner','hr'].includes(r)
export const canViewAll      = (r: string) => ['owner','manager','hr'].includes(r)
export const canAccessTasks  = (r: string) => ['owner','manager','team'].includes(r)
export const canAccessDevBoard = (r: string) => ['owner','manager','developer'].includes(r)
export const canAccessTeam   = (r: string) => ['owner','manager','hr'].includes(r)
export const canAccessPerformance = (r: string) => ['owner','manager','hr'].includes(r)
