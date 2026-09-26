import { cleanHandle, getDb } from '@/lib/db'
import { CHALLENGES } from '@/lib/challenges'

export const dynamic = 'force-dynamic'

// GET /api/progress?handle=x  — the checklist for one unit
export function GET(req: Request) {
  const handle = cleanHandle(new URL(req.url).searchParams.get('handle'))
  const rows = handle
    ? (getDb()
        .prepare('select challenge, min(score) as best from captcha_attempts where handle = ? and passed = 1 group by challenge')
        .all(handle) as { challenge: string; best: number }[])
    : []
  const best = new Map(rows.map((r) => [r.challenge, r.best]))
  return Response.json(
    CHALLENGES.map((c) => ({ ...c, passed: best.has(c.id), best_score: best.get(c.id) ?? null })),
  )
}
