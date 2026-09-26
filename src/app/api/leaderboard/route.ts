import { getDb } from '@/lib/db'
import { CAPTCHA_LEADERBOARD_SQL } from '@/lib/leaderboard'
import { errorResponse } from '@/lib/server-input'

export const dynamic = 'force-dynamic'

export function GET() {
  try { return Response.json(getDb().prepare(CAPTCHA_LEADERBOARD_SQL).all()) }
  catch (error) { return errorResponse(error) }
}
