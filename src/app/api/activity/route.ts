import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export function GET() {
  const rows = getDb().prepare('select id, kind, handle, text, created_at from activity order by id desc limit 50').all()
  return Response.json(rows)
}
