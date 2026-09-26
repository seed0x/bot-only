import { finishRun, readFinish, routeError } from '@/lib/survival/persistence'
import { SURVIVAL_ID_PATTERN } from '@/lib/survival/config'
import { InputError } from '@/lib/server-input'

export const dynamic = 'force-dynamic'
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    if (!SURVIVAL_ID_PATTERN.test(id)) throw new InputError('Invalid run ID.')
    return Response.json(finishRun(id, await readFinish(request, id)))
  } catch (error) { return routeError(error) }
}
