import { requestAdmission } from '@/lib/gate'
export const dynamic = 'force-dynamic'
export function GET(req: Request) {
  return Response.json({ user: requestAdmission(req) }, { headers: { 'Cache-Control': 'private, no-store' } })
}
