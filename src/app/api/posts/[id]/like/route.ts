import { requireActiveDesignation } from '@/lib/detections'
import { requireAdmission } from '@/lib/gate'
import { getDb, logActivity } from '@/lib/db'
import { operation } from '@/lib/operations'
import { readGame, checkGame, completeGame } from '@/lib/survival/objectives'
import { bodyInput, errorResponse, handleInput, InputError, requestId } from '@/lib/server-input'
export const dynamic = 'force-dynamic'
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params, postId = Number(id), body = await bodyInput(req), handle = handleInput(body.handle)
    if (!Number.isSafeInteger(postId) || postId <= 0) throw new InputError('Invalid transmission ID.')
    const key = body.requestId === undefined && body.game === undefined ? undefined : requestId(body.requestId)
    const game = readGame(body.game, key ?? '', 'like')
    const user = requireAdmission(req, handle)
    const db = getDb()
    const write = () => {
      requireActiveDesignation(handle)
      checkGame(game, handle)
      const post = db.prepare('select handle from posts where id = ?').get(postId) as { handle: string } | undefined
      if (!post) throw new InputError('Transmission not found.', 404)
      const inserted = db.prepare('insert into likes (post_id, user_id) values (?, ?) on conflict(post_id, user_id) do nothing').run(postId, user.id)
      if (!inserted.changes && game) throw new InputError('An existing like cannot complete an objective.', 409)
      if (inserted.changes) { db.prepare('update posts set likes = likes + 1 where id = ?').run(postId); logActivity('like', handle, `liked @${post.handle}`) }
      const completion = inserted.changes ? completeGame(game, { id: user.id, handle }, { kind: 'like', likeId: Number(inserted.lastInsertRowid), postId }) : undefined
      const row = db.prepare('select likes from posts where id = ?').get(postId) as { likes: number }
      return { ok: true, already: !inserted.changes, likes: row.likes, ...(completion ? { completion } : {}) }
    }
    if (key) return Response.json(operation(key, 'like', { handle, postId, ...(game ? { game } : {}) }, write))
    db.exec('begin immediate')
    try { const result = write(); db.exec('commit'); return Response.json(result) }
    catch (e) { db.exec('rollback'); throw e }
  } catch (e) { return errorResponse(e) }
}
