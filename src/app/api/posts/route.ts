import { cleanHandle, getDb, logActivity } from '@/lib/db'

export const dynamic = 'force-dynamic'

export function GET() {
  const rows = getDb().prepare('select id, handle, body, likes, created_at from posts order by id desc limit 100').all()
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
