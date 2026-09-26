import { getDb } from '@/lib/db'
import { InputError, errorResponse } from '@/lib/server-input'
import { SURVIVAL_RULES_VERSION, survivalStageAt } from '@/lib/survival/config'
import type { SurvivalInputMode, SurvivalScoreRow, SurvivalScoresResponse } from '@/lib/types'

export const dynamic = 'force-dynamic'

export function GET(request: Request) {
  try {
    const url = new URL(request.url)
    for (const key of url.searchParams.keys()) if (key !== 'inputMode' && key !== 'rulesVersion') throw new InputError('Unknown score filter.')
    const inputMode = url.searchParams.get('inputMode')
    const rulesVersion = url.searchParams.get('rulesVersion') ?? SURVIVAL_RULES_VERSION
    if (inputMode !== 'pointer' && inputMode !== 'touch_or_keyboard') throw new InputError('A valid inputMode is required.')
    if (rulesVersion !== SURVIVAL_RULES_VERSION) throw new InputError('Unknown rules version.')
    const rows = getDb().prepare(`
      with ranked as (
        select r.id as runId, u.handle as handle, r.active_ms as activeMs,
          r.completed_objectives as completedObjectives, r.rules_version as rulesVersion,
          r.input_mode as inputMode,
          row_number() over (partition by r.user_id order by r.active_ms desc, r.completed_objectives desc, r.id asc) as choice
        from game_runs r join users u on u.id=r.user_id
        where r.rules_version=? and r.input_mode=? and r.terminal_status='failed' and r.user_id is not null
      ) select runId,handle,activeMs,completedObjectives from ranked where choice=1
      order by activeMs desc, completedObjectives desc, handle collate binary asc, runId asc
    `).all(rulesVersion, inputMode) as Omit<SurvivalScoreRow, 'roundsSurvived' | 'stage'>[]
    const scores: SurvivalScoreRow[] = rows.map((row) => ({ ...row, roundsSurvived: Math.floor(row.activeMs / 30_000), stage: survivalStageAt(row.activeMs).id }))
    const result: SurvivalScoresResponse = { rulesVersion, inputMode: inputMode as SurvivalInputMode, scores }
    return Response.json(result)
  } catch (error) { return errorResponse(error) }
}

// Caller-selected legacy totals are no longer a score-writing path.
export function POST() {
  return Response.json({ error: 'Legacy score writes are retired. Finish a survival run instead.' }, { status: 410 })
}
