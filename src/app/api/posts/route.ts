import { operation } from '@/lib/operations'
import { getDb, logActivity } from '@/lib/db'
import { requestAdmission, requireAdmission } from '@/lib/gate'
import { bodyInput, errorResponse, handleInput, InputError, requestId } from '@/lib/server-input'
import { checkTransmission, judgeTyping, ruleFor } from '@/lib/transmission'
export const dynamic = 'force-dynamic'
// GET /api/posts — newest 100, pinned first; `liked` is whether the admitted unit liked each one, `comments` the reply count.
export function GET(req: Request) {
  const user = requestAdmission(req)
  if (!user) return Response.json({ error: 'Complete the reverse CAPTCHA to enter.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  const handle = user.handle
  return Response.json(getDb().prepare(`
    select p.id, p.handle, p.body, p.likes, p.pinned, p.created_at,
           case when l.id is null then 0 else 1 end as liked,
           (select count(*) from comments c where c.post_id = p.id) as comments
    from posts p
    left join likes l on l.post_id = p.id and l.user_id = (select id from users where handle = ?)
    order by p.pinned desc, p.id desc limit 100
  `).all(handle), { headers: { 'Cache-Control': 'private, no-store' } })
}
export async function POST(req: Request) {
  try {
    const b = await bodyInput(req), handle = handleInput(b.handle), id = requestId(b.requestId)
    const user = requireAdmission(req, handle)
    if (typeof b.body !== 'string' || !b.body.trim() || b.body.length > 280) throw new InputError('Transmit between 1 and 280 characters.')
    const body = b.body.trim()
    let typing: number[] = []
    if (b.typing !== undefined) {
      if (!Array.isArray(b.typing) || b.typing.length > 400) throw new InputError('Invalid typing record.')
      let prev = -1
      typing = b.typing.map((t) => { if (typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t <= prev || t > 3_600_000) throw new InputError('Invalid typing record.'); prev = t; return t })
    }
    const outcome = operation(id, 'post', { handle, body, typing }, () => {
      const db = getDb()
      // Test 01+: the network's rule for this unit's next transmission, and machine typing rhythm.
      const posted = (db.prepare('select count(*) as n from posts where user_id = ?').get(user.id) as { n: number }).n
      const rule = ruleFor(handle, posted)
      const broken = checkTransmission(rule, body)
      const rhythm = judgeTyping(typing)
      const rejection = broken ?? rhythm.measurement?.explanation ?? null
      if (rejection) {
        logActivity('fail', handle, `transmission rejected. ${rejection}`)
        return { error: rejection }
      }
      const info = db.prepare('insert into posts (user_id, handle, body) values (?, ?, ?)').run(user.id, handle, body)
      logActivity('post', handle, body.length > 60 ? body.slice(0, 60) + '…' : body)
      return { id: Number(info.lastInsertRowid) }
    })
    return Response.json(outcome, { status: 'error' in outcome ? 422 : 200 })
  } catch (e) { return errorResponse(e) }
}
