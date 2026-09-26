import { getDb } from '@/lib/db'
import { threatFromCount } from '@/lib/threat'
export const dynamic = 'force-dynamic'
export function GET() {
  const row = getDb().prepare("select count(*) as n from captcha_attempts where passed = 0 and created_at >= datetime('now', '-5 minutes')").get() as { n: number }
  return Response.json({ ...threatFromCount(row.n), generatedAt: new Date().toISOString() })
}
