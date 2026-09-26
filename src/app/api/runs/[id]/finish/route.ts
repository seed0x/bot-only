import { requestAdmission } from '@/lib/gate'
import { errorResponse } from '@/lib/server-input'
import { SURVIVAL_LIMITS } from '@/lib/survival/config'
import { finishRun, parseFinish, readBody, survivalId } from '@/lib/survival/runs'
export const dynamic = 'force-dynamic'
// The only survival score writer: one terminal snapshot per run, replayable by request ID.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const body = await readBody(req, SURVIVAL_LIMITS.finishBodyBytes)
    return Response.json(finishRun(parseFinish(survivalId((await ctx.params).id, 'run ID'), body), requestAdmission(req)))
  } catch (error) { return errorResponse(error) }
}
