import { cleanHandle, getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

type ScoreInput = {
  unitDesignation?: unknown
  bestTimeMs?: unknown
  roundsSurvived?: unknown
}

export function GET() {
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
