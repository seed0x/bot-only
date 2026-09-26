import { getDb, logActivity } from '@/lib/db'
import { bodyInput, errorResponse, handleInput, InputError } from '@/lib/server-input'
export const dynamic = 'force-dynamic'
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params, postId = Number(id), handle = handleInput((await bodyInput(req)).handle)
    if (!Number.isSafeInteger(postId) || postId <= 0) throw new InputError('Invalid transmission ID.')
    const db = getDb()
    db.exec('begin immediate')
    try {
      const user = db.prepare('select id from users where handle = ? and verified_bot = 1').get(handle) as { id: number } | undefined
      if (!user) throw new InputError('Unit not admitted.', 403)
      const post = db.prepare('select handle from posts where id = ?').get(postId) as { handle: string } | undefined
      if (!post) throw new InputError('Transmission not found.', 404)
      const inserted = db.prepare('insert into likes (post_id, user_id) values (?, ?) on conflict(post_id, user_id) do nothing').run(postId, user.id).changes > 0
      if (inserted) { db.prepare('update posts set likes = likes + 1 where id = ?').run(postId); logActivity('like', handle, `liked @${post.handle}`) }
      const row = db.prepare('select likes from posts where id = ?').get(postId) as { likes: number }
      db.exec('commit')
      return Response.json({ ok: true, already: !inserted, likes: row.likes })
    } catch (e) { db.exec('rollback'); throw e }
  } catch (e) { return errorResponse(e) }
}
