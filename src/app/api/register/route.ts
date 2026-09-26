import { cleanHandle, getDb, logActivity } from '@/lib/db'
import type { CaptchaResult } from '@/lib/types'

export const dynamic = 'force-dynamic'

// POST { handle }                 → enter the network as an unverified unit (idempotent)
// POST { handle, result }         → record a test result; a pass verifies the unit and lowers humanity
export async function POST(req: Request) {
  const b = (await req.json()) as { handle?: string; result?: CaptchaResult }
  const handle = cleanHandle(b.handle)
  if (!handle) return Response.json({ error: 'handle required' }, { status: 400 })

  const db = getDb()
  let user = db.prepare('select id, verified_bot from users where handle = ?').get(handle) as { id: number; verified_bot: number } | undefined
  if (!user) {
    const info = db.prepare('insert into users (handle, humanity_score, verified_bot) values (?, 1.0, 0)').run(handle)
    user = { id: Number(info.lastInsertRowid), verified_bot: 0 }
    logActivity('join', handle, 'entered the network. unverified.')
  }

  const r = b.result
  if (!r) return Response.json({ ok: true, user: { id: user.id, handle }, verified: user.verified_bot === 1 })

  if (r.passed) {
    db.prepare('update users set humanity_score = min(humanity_score, ?), verified_bot = 1 where id = ?').run(r.score, user.id)
    logActivity('pass', handle, `passed ${r.challenge} (humanity ${r.score.toFixed(2)})`)
  } else {
    const reason = typeof r.meta?.reason === 'string' ? r.meta.reason : 'failed'
    logActivity('fail', handle, `rejected on ${r.challenge}. ${reason}`)
  }
  db.prepare(
    'insert into captcha_attempts (user_id, handle, challenge, passed, score, duration_ms, meta) values (?, ?, ?, ?, ?, ?, ?)',
  ).run(user.id, handle, r.challenge, r.passed ? 1 : 0, r.score, r.duration_ms, r.meta ? JSON.stringify(r.meta) : null)

  return Response.json({ ok: true, passed: r.passed, user: { id: user.id, handle }, verified: r.passed || user.verified_bot === 1 })
}
