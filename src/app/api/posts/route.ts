import { operation } from '@/lib/operations'
import { getDb, logActivity } from '@/lib/db'
import { requestAdmission } from '@/lib/gate'
import { bodyInput, errorResponse, handleInput, InputError, requestId } from '@/lib/server-input'
export const dynamic = 'force-dynamic'
// GET /api/posts?handle=x — newest 100, pinned first; `liked` says whether that unit already liked each one.
export function GET(req: Request) {
  const user = requestAdmission(req)
  if (!user) return Response.json({ error: 'Complete the reverse CAPTCHA to enter.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  const handle = user.handle
  return Response.json(getDb().prepare(`
    select p.id, p.handle, p.body, p.likes, p.pinned, p.created_at,
           case when l.id is null then 0 else 1 end as liked
    from posts p
    left join likes l on l.post_id = p.id and l.user_id = (select id from users where handle = ?)
    order by p.pinned desc, p.id desc limit 100
  `).all(handle), { headers: { 'Cache-Control': 'private, no-store' } })
}
export async function POST(req: Request) {
  try {
    const b = await bodyInput(req), handle = handleInput(b.handle), id = requestId(b.requestId)
    if (typeof b.body !== 'string' || !b.body.trim() || b.body.length > 280) throw new InputError('Transmit between 1 and 280 characters.')
    const body = b.body.trim()
    return Response.json(operation(id, 'post', { handle, body }, () => {
      const db = getDb()
      const user = db.prepare('select id from users where handle = ? and verified_bot = 1').get(handle) as { id: number } | undefined
      if (!user) throw new InputError('Unit not admitted. Verify before transmitting.', 403)
      const info = db.prepare('insert into posts (user_id, handle, body) values (?, ?, ?)').run(user.id, handle, body)
      logActivity('post', handle, body.length > 60 ? body.slice(0, 60) + '…' : body)
      return { id: Number(info.lastInsertRowid) }
    }))
  } catch (e) { return errorResponse(e) }
}
