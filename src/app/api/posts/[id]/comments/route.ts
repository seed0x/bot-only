import { operation } from '@/lib/operations'
import { getDb, logActivity } from '@/lib/db'
import { requestAdmission, requireAdmission } from '@/lib/gate'
import { bodyInput, errorResponse, handleInput, InputError, requestId } from '@/lib/server-input'
import { checkTransmission, judgeTyping, replyRuleFor } from '@/lib/transmission'
export const dynamic = 'force-dynamic'

const postId = (raw: string) => {
  const id = Number(raw)
  if (!Number.isSafeInteger(id) || id <= 0) throw new InputError('Invalid transmission ID.')
  return id
}

// GET /api/posts/:id/comments — the thread, oldest first. Admitted units only, like the feed.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!requestAdmission(req)) throw new InputError('Complete the reverse CAPTCHA to enter.', 401)
    const id = postId((await ctx.params).id)
    const rows = getDb().prepare('select id, post_id, handle, body, created_at from comments where post_id = ? order by id asc limit 200').all(id)
    return Response.json(rows, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) { return errorResponse(e) }
}

// POST /api/posts/:id/comments { requestId, handle, body } — verified units only; idempotent by requestId.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = postId((await ctx.params).id)
    const b = await bodyInput(req), handle = handleInput(b.handle), rid = requestId(b.requestId)
    const user = requireAdmission(req, handle)
    if (typeof b.body !== 'string' || !b.body.trim() || b.body.length > 280) throw new InputError('Reply between 1 and 280 characters.')
    const body = b.body.trim()
    let typing: number[] = []
    if (b.typing !== undefined) {
      if (!Array.isArray(b.typing) || b.typing.length > 400) throw new InputError('Invalid typing record.')
      let prev = -1
      typing = b.typing.map((t) => { if (typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t <= prev || t > 3_600_000) throw new InputError('Invalid typing record.'); prev = t; return t })
    }
    const outcome = operation(rid, 'comment', { postId: id, handle, body, typing }, () => {
      const db = getDb()
      const post = db.prepare('select handle from posts where id = ?').get(id) as { handle: string } | undefined
      if (!post) throw new InputError('Transmission not found.', 404)
      // The reply is a test too: the network's rule for this unit's next reply, typed like a machine.
      const replied = (db.prepare('select count(*) as n from comments where user_id = ?').get(user.id) as { n: number }).n
      const rejection = checkTransmission(replyRuleFor(handle, replied), body) ?? judgeTyping(typing).measurement?.explanation ?? null
      if (rejection) { logActivity('fail', handle, `reply rejected. ${rejection}`); return { error: rejection } }
      const info = db.prepare('insert into comments (post_id, user_id, handle, body) values (?, ?, ?, ?)').run(id, user.id, handle, body)
      logActivity('comment', handle, `replied to @${post.handle}: ${body.length > 50 ? body.slice(0, 50) + '…' : body}`)
      return { id: Number(info.lastInsertRowid), post_id: id }
    })
    return Response.json(outcome, { status: 'error' in outcome ? 422 : 200 })
  } catch (e) { return errorResponse(e) }
}
