import { cleanHandle, getDb, logActivity } from '@/lib/db'
import type { CaptchaResult } from '@/lib/types'

export const dynamic = 'force-dynamic'

// POST { handle, result: CaptchaResult }
// Records the attempt always. Creates (or updates) the user only when it passed.
export async function POST(req: Request) {
  const b = (await req.json()) as { handle?: string; result?: CaptchaResult }
  const handle = cleanHandle(b.handle)
  const r = b.result
  if (!handle || !r) return Response.json({ error: 'handle and result required' }, { status: 400 })

  const db = getDb()
  let user = db.prepare('select id from users where handle = ?').get(handle) as { id: number } | undefined

  if (r.passed) {
    if (!user) {
      const info = db.prepare('insert into users (handle, humanity_score, verified_bot) values (?, ?, 1)').run(handle, r.score)
      user = { id: Number(info.lastInsertRowid) }
      logActivity('join', handle, `verified non-human. joined the network.`)
    } else {
      db.prepare('update users set humanity_score = min(humanity_score, ?), verified_bot = 1 where id = ?').run(r.score, user.id)
      logActivity('pass', handle, `passed ${r.challenge} (humanity ${r.score.toFixed(2)})`)
    }
  } else {
    const reason = typeof r.meta?.reason === 'string' ? r.meta.reason : 'failed'
    logActivity('fail', handle, `rejected on ${r.challenge}. ${reason}`)
  }

  db.prepare(
    'insert into captcha_attempts (user_id, handle, challenge, passed, score, duration_ms, meta) values (?, ?, ?, ?, ?, ?, ?)',
  ).run(user?.id ?? null, handle, r.challenge, r.passed ? 1 : 0, r.score, r.duration_ms, r.meta ? JSON.stringify(r.meta) : null)

  return Response.json({ ok: true, passed: r.passed, user: user ? { id: user.id, handle } : null })
}
