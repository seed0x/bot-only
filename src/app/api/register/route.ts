import { registerUnit, submitAttempt } from '@/lib/game'
import { bodyInput, errorResponse } from '@/lib/server-input'
export const dynamic = 'force-dynamic'
export async function POST(req: Request) {
  try {
    const body = await bodyInput(req)
    return Response.json('solution' in body || 'challengeId' in body || 'result' in body ? submitAttempt(body) : registerUnit(body))
  }
  catch (error) { return errorResponse(error) }
}
