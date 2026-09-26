import { readStart, routeError, startRun } from '@/lib/survival/persistence'

export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  try { return Response.json(startRun(await readStart(request))) }
  catch (error) { return routeError(error) }
}
