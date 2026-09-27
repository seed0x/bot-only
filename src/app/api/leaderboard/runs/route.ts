import { getDb } from '@/lib/db'
import { LONGEST_RUNS_SQL } from '@/lib/leaderboard'
import { errorResponse } from '@/lib/server-input'

export const dynamic = 'force-dynamic'

export function GET() {
  try { return Response.json(getDb().prepare(LONGEST_RUNS_SQL).all()) }
  catch (error) { return errorResponse(error) }
}
