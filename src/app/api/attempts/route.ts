import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export function GET() {
  const rows = getDb().prepare('select * from attempts order by id desc limit 100').all()
  return Response.json(rows)
}

export async function POST(req: Request) {
  const b = await req.json()
  const info = getDb()
    .prepare('insert into attempts (name, challenge, passed, score, meta) values (?, ?, ?, ?, ?)')
    .run(
      String(b.name ?? 'anon'),
      String(b.challenge ?? ''),
      b.passed ? 1 : 0,
      Number(b.score ?? 0),
      b.meta ? JSON.stringify(b.meta) : null,
    )
  return Response.json({ id: Number(info.lastInsertRowid) })
}
