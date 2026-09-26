import { cleanHandle, getDb, logActivity } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST { handle }  — one like per unit per post
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const postId = Number(id)
  const b = (await req.json().catch(() => ({}))) as { handle?: string }
  const handle = cleanHandle(b.handle)
  const db = getDb()
  const user = db.prepare('select id from users where handle = ? and verified_bot = 1').get(handle) as { id: number } | undefined
  if (!user) return Response.json({ error: 'humans cannot like' }, { status: 403 })
  const post = db.prepare('select id, handle from posts where id = ?').get(postId) as { id: number; handle: string } | undefined
  if (!post) return Response.json({ error: 'no such post' }, { status: 404 })
  const existing = db.prepare('select id from likes where post_id = ? and user_id = ?').get(postId, user.id)
  if (existing) {
    const row = db.prepare('select likes from posts where id = ?').get(postId) as { likes: number }
    return Response.json({ ok: true, already: true, likes: row.likes })
  }

  // Keep the unique like, public counter, and activity event in one commit.
  db.exec('begin immediate')
  try {
    db.prepare('insert into likes (post_id, user_id) values (?, ?)').run(postId, user.id)
    db.prepare('update posts set likes = likes + 1 where id = ?').run(postId)
    logActivity('like', handle, `liked @${post.handle}`)
    const row = db.prepare('select likes from posts where id = ?').get(postId) as { likes: number }
    db.exec('commit')
    return Response.json({ ok: true, likes: row.likes })
  } catch (error) {
    db.exec('rollback')
    throw error
  }
}
