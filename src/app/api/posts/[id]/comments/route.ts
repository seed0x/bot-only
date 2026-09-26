import { operation } from '@/lib/operations'
import { getDb, logActivity } from '@/lib/db'
import { requestAdmission } from '@/lib/gate'
import { bodyInput, errorResponse, handleInput, InputError, requestId } from '@/lib/server-input'
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
    if (typeof b.body !== 'string' || !b.body.trim() || b.body.length > 280) throw new InputError('Reply between 1 and 280 characters.')
    const body = b.body.trim()
    return Response.json(operation(rid, 'comment', { postId: id, handle, body }, () => {
      const db = getDb()
      const user = db.prepare('select id from users where handle = ? and verified_bot = 1').get(handle) as { id: number } | undefined
      if (!user) throw new InputError('Unit not admitted. Verify before replying.', 403)
      const post = db.prepare('select handle from posts where id = ?').get(id) as { handle: string } | undefined
      if (!post) throw new InputError('Transmission not found.', 404)
      const info = db.prepare('insert into comments (post_id, user_id, handle, body) values (?, ?, ?, ?)').run(id, user.id, handle, body)
      logActivity('comment', handle, `replied to @${post.handle}: ${body.length > 50 ? body.slice(0, 50) + '…' : body}`)
      return { id: Number(info.lastInsertRowid), post_id: id }
    }))
  } catch (e) { return errorResponse(e) }
}
