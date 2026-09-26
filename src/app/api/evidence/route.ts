import { getDb } from '@/lib/db'
import type { AttemptReceipt } from '@/lib/types'
export const dynamic = 'force-dynamic'
export function GET() {
  const db = getDb()
  function latest(passed: number) {
    const row = db.prepare("select id, handle, score, duration_ms, meta, created_at from captcha_attempts where challenge = 'straight-line' and passed = ? and json_valid(meta) and json_type(meta, '$.trace') = 'array' order by id desc limit 1").get(passed) as { id: number; handle: string; score: number; duration_ms: number; meta: string; created_at: string } | undefined
    if (!row) return null
    return { attemptId: row.id, handle: row.handle, passed: !!passed, result: { challenge: 'straight-line', passed: !!passed, score: row.score, duration_ms: row.duration_ms, meta: JSON.parse(row.meta) }, recordedAt: row.created_at } satisfies Pick<AttemptReceipt,'attemptId'|'handle'|'passed'|'result'|'recordedAt'>
  }
  return Response.json({ rejected: latest(0), admitted: latest(1) })
}
