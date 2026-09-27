import { NextResponse } from 'next/server'
import { endAdmission, GATE_COOKIE } from '@/lib/gate'
import { errorResponse } from '@/lib/server-input'
export const dynamic = 'force-dynamic'

export function POST(req: Request) {
  try {
    endAdmission(req)
    const response = NextResponse.json({ ok: true })
    response.cookies.set(GATE_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0,
      secure: new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https' })
    return response
  } catch (error) { return errorResponse(error) }
}
