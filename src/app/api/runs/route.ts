import { errorResponse } from '@/lib/server-input'
import { SURVIVAL_LIMITS } from '@/lib/survival/config'
import { parseStart, readBody, startRun } from '@/lib/survival/runs'
export const dynamic = 'force-dynamic'
// Start a survival run. Anonymous starts are allowed; only bound failed runs rank.
export async function POST(req: Request) {
  try { return Response.json(startRun(parseStart(await readBody(req, SURVIVAL_LIMITS.requestBodyBytes)))) }
  catch (error) { return errorResponse(error) }
}
