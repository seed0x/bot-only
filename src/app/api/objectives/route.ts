import { cleanHandle, getDb } from '@/lib/db'
import type { ObjectiveProgress } from '@/lib/types'

export const dynamic = 'force-dynamic'

export function GET(req: Request) {
  const handle = cleanHandle(new URL(req.url).searchParams.get('handle'))
  try {
    const row = getDb().prepare(`
      select
        exists(select 1 from posts where user_id = u.id) as posted,
        exists(select 1 from likes where user_id = u.id) as liked
      from users u where handle = ?
    `).get(handle) as { posted: number; liked: number } | undefined
    return Response.json({ post: row?.posted === 1, comment: null, like: row?.liked === 1 } satisfies ObjectiveProgress)
  } catch {
    return Response.json({ error: 'Objectives unavailable. Retry.' }, { status: 500 })
  }
}
