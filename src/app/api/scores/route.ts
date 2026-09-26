import { errorResponse } from '@/lib/server-input'
import { parseScoreQuery, survivalScores } from '@/lib/survival/runs'

export const dynamic = 'force-dynamic'

// GET /api/scores?inputMode=pointer|touch_or_keyboard[&rulesVersion=…] — survival rankings, fed only by run finish.
export function GET(req: Request) {
  try { return Response.json(survivalScores(parseScoreQuery(new URL(req.url).searchParams))) }
  catch (error) { return errorResponse(error) }
}
