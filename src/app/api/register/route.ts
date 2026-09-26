import { registerUnit, submitAttempt } from '@/lib/game'
import { bodyInput, errorResponse } from '@/lib/server-input'
import { NextResponse } from 'next/server'
import { GATE_COOKIE, GATE_TTL_SECONDS, issueAdmission } from '@/lib/gate'
export const dynamic = 'force-dynamic'
export async function POST(req: Request) {
  try {
    const body = await bodyInput(req)
    const attempt = 'solution' in body || 'challengeId' in body || 'result' in body
    const receipt = attempt ? submitAttempt(body) : null
    const response = NextResponse.json(receipt ?? registerUnit(body))
    // Only a new identity or image trial changes browser admission.
    // Other games can record results without signing the admitted browser out.
    if (!receipt || receipt.result.challenge === 'image-confusion') {
      const token = receipt ? issueAdmission(receipt) : null
      response.cookies.set(GATE_COOKIE, token ?? '', {
        httpOnly: true, sameSite: 'lax', path: '/',
        secure: new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https',
        maxAge: token ? GATE_TTL_SECONDS : 0,
      })
    }
    return response
  }
  catch (error) { return errorResponse(error) }
}
