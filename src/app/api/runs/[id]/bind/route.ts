import { requestAdmission } from '@/lib/gate'
import { errorResponse } from '@/lib/server-input'
import { SURVIVAL_LIMITS } from '@/lib/survival/config'
import { bindRun, parseBind, readBody, survivalId } from '@/lib/survival/runs'
export const dynamic = 'force-dynamic'
// Bind a run to the identity admitted by this browser's HttpOnly cookie.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const input = parseBind(await readBody(req, SURVIVAL_LIMITS.requestBodyBytes))
    return Response.json(bindRun(survivalId((await ctx.params).id, 'run ID'), input, requestAdmission(req)))
  } catch (error) { return errorResponse(error) }
}
