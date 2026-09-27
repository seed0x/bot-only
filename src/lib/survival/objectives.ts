import { randomUUID } from 'node:crypto'
import { getDb } from '../db'
import { InputError, object, requestId } from '../server-input'
import type { SessionUser, SurvivalActionReference, SurvivalObjectiveReceipt, SurvivalObjectiveSubmission } from '../types'
import { SURVIVAL_LIMITS, SURVIVAL_RULES_VERSION, SURVIVAL_TIMING, survivalStageAt } from './config'

// Normalize before fingerprinting. Absence alone preserves the legacy write contract.
export function readGame(value: unknown, enclosingId: string, kind: SurvivalObjectiveSubmission['kind']) {
  if (value === undefined) return undefined
  const g = object(value)
  const fields = ['runId', 'objectiveId', 'requestId', 'kind', 'submittedAtActiveMs', 'issuedAtActiveMs', 'deadlineActiveMs', 'stage']
  if (Object.keys(g).length !== fields.length || fields.some(f => !(f in g))) throw new InputError('Invalid game association fields.')
  const runId = requestId(g.runId), objectiveId = requestId(g.objectiveId), id = requestId(g.requestId)
  if (id !== enclosingId || g.kind !== kind) throw new InputError('Game association does not match this action.')
  for (const field of ['submittedAtActiveMs', 'issuedAtActiveMs', 'deadlineActiveMs']) {
    if (typeof g[field] !== 'number' || !Number.isFinite(g[field]) || (g[field] as number) < 0 || (g[field] as number) > SURVIVAL_LIMITS.activeMsMax) throw new InputError('Invalid objective time.')
  }
  const issued = g.issuedAtActiveMs as number, submitted = g.submittedAtActiveMs as number, deadline = g.deadlineActiveMs as number
  const stage = survivalStageAt(issued)
  const budget = kind === 'admission' ? SURVIVAL_TIMING.admissionBudgetMs : stage.objectiveBudgetMs
  if (g.stage !== stage.id || deadline !== issued + budget || submitted < issued || submitted > deadline) throw new InputError('Objective deadline or stage does not match its budget.')
  return { runId, objectiveId, requestId: id, kind, submittedAtActiveMs: submitted, issuedAtActiveMs: issued, deadlineActiveMs: deadline, stage: stage.id } satisfies SurvivalObjectiveSubmission
}

// Called inside the enclosing action's operation transaction, before any domain writes.
export function checkGame(g: SurvivalObjectiveSubmission | undefined, handle: string) {
  if (!g) return
  const db = getDb()
  const run = db.prepare('select rules_version,user_id,terminal_status from game_runs where id=?').get(g.runId) as { rules_version: string; user_id: number | null; terminal_status: string | null } | undefined
  if (!run) throw new InputError('Run not found.', 404)
  if (run.rules_version !== SURVIVAL_RULES_VERSION || run.terminal_status) throw new InputError('Run cannot accept objectives.', 409)
  const user = db.prepare('select id,verified_bot from users where handle=?').get(handle) as { id: number; verified_bot: number } | undefined
  if (run.user_id !== null && run.user_id !== user?.id) throw new InputError('Run belongs to another identity.', 409)
  if (g.kind !== 'admission' && (!user?.verified_bot || run.user_id !== user.id)) throw new InputError('Bind an admitted identity before this objective.', 403)
  if (db.prepare('select 1 from game_objective_events where run_id=? and objective_id=?').get(g.runId, g.objectiveId)) throw new InputError('Objective already completed.', 409)
  const events = db.prepare('select action_kind,submitted_active_ms from game_objective_events where run_id=? order by rowid desc').all(g.runId) as { action_kind: string; submitted_active_ms: number }[]
  if (events.length >= SURVIVAL_LIMITS.objectivesMax) throw new InputError('Objective limit reached.', 409)
  const previous = events[0]
  const allowed = previous ? previous.action_kind === 'post' ? ['like', 'post'] : ['post'] : run.user_id === null ? ['admission'] : ['post']
  if (!allowed.includes(g.kind) || (previous && g.issuedAtActiveMs < previous.submitted_active_ms)) throw new InputError('Objective is out of sequence.', 409)
}

export function completeGame(g: SurvivalObjectiveSubmission | undefined, user: SessionUser, action: SurvivalActionReference): SurvivalObjectiveReceipt | undefined {
  if (!g) return
  const db = getDb()
  if (action.kind !== g.kind) throw new InputError('Action does not match objective.', 409)
  const receipt: SurvivalObjectiveReceipt = { runId: g.runId, objectiveId: g.objectiveId, requestId: g.requestId, completionId: randomUUID(), user, action, recordedAt: new Date().toISOString() }
  if (action.kind === 'admission') db.prepare('update game_runs set user_id=? where id=? and user_id is null').run(user.id, g.runId)
  const actionId = action.kind === 'admission' ? action.attemptId : action.kind === 'post' ? action.postId : action.likeId
  db.prepare(`insert into game_objective_events
    (completion_id,run_id,objective_id,request_id,user_id,action_kind,action_id,target_post_id,issued_active_ms,submitted_active_ms,deadline_active_ms,stage,receipt_json,recorded_at)
    values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(receipt.completionId, g.runId, g.objectiveId, g.requestId, user.id, action.kind, actionId, action.kind === 'like' ? action.postId : null, g.issuedAtActiveMs, g.submittedAtActiveMs, g.deadlineActiveMs, g.stage, JSON.stringify(receipt), receipt.recordedAt)
  return receipt
}
