import { cleanHandle, getDb } from '@/lib/db'
import { errorResponse } from '@/lib/server-input'
import { parseScoreQuery, survivalScores } from '@/lib/survival/runs'

export const dynamic = 'force-dynamic'

type ScoreInput = {
  unitDesignation?: unknown
  bestTimeMs?: unknown
  roundsSurvived?: unknown
}

// GET ?inputMode=…[&rulesVersion=…] is the survival ranking (SurvivalScoresResponse), fed only by run finish.
// A bare GET and the POST below are the legacy client-reported table, kept for existing consumers
// (scripts/smoke.mjs) until they migrate; the survival leaderboard never reads it.
export function GET(req: Request) {
  const params = new URL(req.url).searchParams
  if (params.size) {
    try { return Response.json(survivalScores(parseScoreQuery(params))) }
    catch (error) { return errorResponse(error) }
  }
  const scores = getDb().prepare(`
    select unit_designation as unitDesignation,
           best_time_ms as bestTimeMs,
           rounds_survived as roundsSurvived
    from leaderboard
    order by best_time_ms desc,
             rounds_survived desc,
             unit_designation collate nocase asc
  `).all()
  return Response.json(scores)
}

export async function POST(request: Request) {
  let input: ScoreInput
  try {
    input = await request.json() as ScoreInput
  } catch {
    return Response.json({ error: 'A JSON score body is required' }, { status: 400 })
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return Response.json({ error: 'A JSON score body is required' }, { status: 400 })
  }

  const unitDesignation = cleanHandle(input.unitDesignation)
  const bestTimeMs = input.bestTimeMs
  const roundsSurvived = input.roundsSurvived

  if (!unitDesignation) {
    return Response.json({ error: 'unitDesignation is required' }, { status: 400 })
  }
  if (typeof bestTimeMs !== 'number' || !Number.isSafeInteger(bestTimeMs) || bestTimeMs < 0) {
    return Response.json({ error: 'bestTimeMs must be a non-negative safe integer' }, { status: 400 })
  }
  if (typeof roundsSurvived !== 'number' || !Number.isSafeInteger(roundsSurvived) || roundsSurvived < 0) {
    return Response.json({ error: 'roundsSurvived must be a non-negative safe integer' }, { status: 400 })
  }

  getDb().prepare(`
    insert into leaderboard (unit_designation, best_time_ms, rounds_survived)
    values (?, ?, ?)
    on conflict(unit_designation) do update set
      best_time_ms = excluded.best_time_ms,
      rounds_survived = excluded.rounds_survived
  `).run(unitDesignation, bestTimeMs, roundsSurvived)

  return Response.json({
    ok: true,
    unitDesignation,
    bestTimeMs,
    roundsSurvived,
  })
}
