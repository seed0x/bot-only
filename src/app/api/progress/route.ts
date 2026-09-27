import { cleanHandle, getDb } from '@/lib/db'
import { CHALLENGES } from '@/lib/challenges'
import { ruleFor } from '@/lib/transmission'

export const dynamic = 'force-dynamic'

// Three human detections on one designation end its run.
export const DETECTION_LIMIT = 3

// GET /api/progress?handle=x  — humanity plus every test with passed / best score for one unit
export function GET(req: Request) {
  const handle = cleanHandle(new URL(req.url).searchParams.get('handle'))
  const db = getDb()
  const user = handle ? (db.prepare('select humanity_score, verified_bot from users where handle = ?').get(handle) as { humanity_score: number; verified_bot: number } | undefined) : undefined
  const rows = handle
    ? (db.prepare('select challenge, min(score) as best from captcha_attempts where handle = ? and passed = 1 group by challenge').all(handle) as { challenge: string; best: number }[])
    : []
  const best = new Map(rows.map((r) => [r.challenge, r.best]))
  const posted = handle ? (db.prepare('select count(*) as n from posts where handle = ?').get(handle) as { n: number }).n : 0
  const detections = handle ? (db.prepare("select count(*) as n from activity where kind = 'fail' and handle = ?").get(handle) as { n: number }).n : 0
  const replied = handle ? (db.prepare('select count(*) as n from comments where handle = ?').get(handle) as { n: number }).n : 0
  return Response.json({
    humanity: user?.humanity_score ?? null,
    verified: user?.verified_bot === 1,
    detections,
    terminated: detections >= DETECTION_LIMIT,
    transmission: handle ? ruleFor(handle, posted) : null,
    reply: handle ? ruleFor(handle + ':reply', replied + 2) : null,
    challenges: CHALLENGES.map((c) => ({ ...c, passed: best.has(c.id), best_score: best.get(c.id) ?? null })),
  })
}
