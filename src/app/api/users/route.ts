import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export function GET() {
  const rows = getDb()
    .prepare('select id, handle, humanity_score, verified_bot, created_at from users order by humanity_score asc limit 100')
    .all()
  return Response.json(rows)
}
