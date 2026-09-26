import { getDb } from '@/lib/db'
import type { RecordedResult } from '@/lib/results'

export const dynamic = 'force-dynamic'
export function GET() {
  const rows = getDb().prepare(`select id, handle, passed, score, duration_ms, meta, created_at
    from captcha_attempts where challenge = 'image-confusion'
    order by id desc limit 20`).all() as {
      id: number; handle: string; passed: number; score: number; duration_ms: number; meta: string; created_at: string
    }[]
  const results: RecordedResult[] = rows.map(row => ({
    attemptId: row.id, handle: row.handle, passed: row.passed === 1, recordedAt: row.created_at,
    result: { challenge: 'image-confusion', passed: row.passed === 1, score: row.score,
      duration_ms: row.duration_ms, meta: JSON.parse(row.meta) },
  }))
  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } })
}
