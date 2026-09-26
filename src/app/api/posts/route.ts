import { cleanHandle, getDb, logActivity } from '@/lib/db'

export const dynamic = 'force-dynamic'

export function GET(req: Request) {
  const handle = cleanHandle(new URL(req.url).searchParams.get('handle'))
  const rows = getDb().prepare(`
    select p.id, p.handle, p.body, p.likes, p.pinned, p.created_at,
      case when l.id is null then 0 else 1 end as liked
    from posts p
    left join likes l on l.post_id = p.id and l.user_id = (select id from users where handle = ?)
    order by p.pinned desc, p.id desc limit 100
  `).all(handle)
  return Response.json(rows)
}

// POST { handle, body }  — only verified units may post
export async function POST(req: Request) {
  const b = (await req.json()) as { handle?: string; body?: string }
  const handle = cleanHandle(b.handle)
  const body = String(b.body ?? '').trim().slice(0, 280)
  if (!handle || !body) return Response.json({ error: 'handle and body required' }, { status: 400 })
  const db = getDb()
  const user = db.prepare('select id from users where handle = ? and verified_bot = 1').get(handle) as { id: number } | undefined
  if (!user) return Response.json({ error: 'humans cannot post' }, { status: 403 })
  const info = db.prepare('insert into posts (user_id, handle, body) values (?, ?, ?)').run(user.id, handle, body)
  logActivity('post', handle, body.length > 60 ? body.slice(0, 60) + '…' : body)
  return Response.json({ id: Number(info.lastInsertRowid) })
}
