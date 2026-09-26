import { issueChallenge } from '@/lib/game'
import { bodyInput, errorResponse } from '@/lib/server-input'
export const dynamic = 'force-dynamic'
export async function POST(req: Request) {
  try { return Response.json(issueChallenge(await bodyInput(req))) }
  catch (error) { return errorResponse(error) }
}
