import { randomUUID } from 'node:crypto'
import { getDb } from '../db'
import { operation } from '../operations'
import { errorResponse, InputError, object, requestId } from '../server-input'
import type { SurvivalFailureReason, SurvivalInputMode, SurvivalMeasurement, SurvivalPointerSample, SurvivalTerminalSnapshot } from '../types'
import { SURVIVAL_FAILURE_PRECEDENCE, SURVIVAL_ID_PATTERN, SURVIVAL_LIMITS, SURVIVAL_RULES_VERSION, SURVIVAL_STAGES, SURVIVAL_TIMING, survivalStageAt } from './config'

const reasons = new Set<string>(SURVIVAL_FAILURE_PRECEDENCE)
const modes = new Set<string>(['pointer', 'touch_or_keyboard'])
const stages = new Set<string>(SURVIVAL_STAGES.map((stage) => stage.id))
const exact = (value: Record<string, unknown>, fields: string[]) => {
  if (Object.keys(value).length !== fields.length || fields.some((field) => !(field in value))) throw new InputError('Request fields do not match this operation.')
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
function boundedBody(req: Request, max: number) {
  return req.text().then((raw) => {
    if (Buffer.byteLength(raw) > max) throw new InputError('Request too large.', 413)
    try { return object(JSON.parse(raw)) } catch (error) {
      if (error instanceof InputError) throw error
      throw new InputError('Invalid JSON.')
    }
  })
}
export async function readStart(req: Request) {
  const body = await boundedBody(req, SURVIVAL_LIMITS.requestBodyBytes)
  exact(body, ['requestId', 'rulesVersion', 'inputMode'])
  const id = requestId(body.requestId)
  if (body.rulesVersion !== SURVIVAL_RULES_VERSION) throw new InputError('Unknown rules version.')
  if (typeof body.inputMode !== 'string' || !modes.has(body.inputMode)) throw new InputError('Invalid input mode.')
  return { requestId: id, rulesVersion: SURVIVAL_RULES_VERSION, inputMode: body.inputMode as SurvivalInputMode }
}
export async function readBind(req: Request) {
  const body = await boundedBody(req, SURVIVAL_LIMITS.requestBodyBytes)
  exact(body, ['requestId', 'handle'])
  const id = requestId(body.requestId)
  if (typeof body.handle !== 'string' || !/^[a-z0-9_]{1,24}$/.test(body.handle) || body.handle === 'system') throw new InputError('Invalid handle.')
  return { requestId: id, handle: body.handle }
}
function id(value: unknown, label: string) {
  if (typeof value !== 'string' || !SURVIVAL_ID_PATTERN.test(value)) throw new InputError(`Invalid ${label}.`)
  return value
}
function measurement(value: unknown, terminalMs: number): SurvivalMeasurement {
  const m = object(value)
  exact(m, ['reason', 'activeMs', 'stage', 'value', 'threshold', 'unit', 'explanation'])
  if (typeof m.reason !== 'string' || !reasons.has(m.reason)) throw new InputError('Invalid evidence reason.')
  if (!finite(m.activeMs) || m.activeMs !== terminalMs) throw new InputError('Evidence time must match terminal time.')
  if (typeof m.stage !== 'string' || !stages.has(m.stage)) throw new InputError('Invalid evidence stage.')
  const expectedStage = m.reason === 'pointer' || m.reason === 'typing' || m.reason === 'scroll' ? m.stage : survivalStageAt(terminalMs).id
  if (m.reason !== 'objective_deadline' && m.stage !== expectedStage) throw new InputError('Invalid evidence stage.')
  if (SURVIVAL_STAGES.findIndex((s) => s.id === m.stage) > SURVIVAL_STAGES.findIndex((s) => s.id === survivalStageAt(terminalMs).id)) throw new InputError('Evidence stage is later than terminal stage.')
  if (!finite(m.value) || m.value < 0 || !finite(m.threshold) || m.threshold < 0 || typeof m.explanation !== 'string' || m.explanation.length < 1 || m.explanation.length > SURVIVAL_LIMITS.explanationMaxLength) throw new InputError('Invalid evidence values.')
  const unitByReason: Record<string, string> = { verification_failed: 'boolean', objective_deadline: 'ms', idle: 'ms', pointer: 'ratio', typing: 'cv', scroll: 'cv' }
  if (m.reason === 'typing' && m.unit === 'wpm') unitByReason.typing = 'wpm'
  if (m.unit !== unitByReason[m.reason]) throw new InputError('Invalid evidence unit.')
  if (m.unit === 'boolean' && (m.value !== 1 || m.threshold !== 0)) throw new InputError('Invalid verification evidence.')
  if (m.reason === 'verification_failed' && m.unit !== 'boolean') throw new InputError('Invalid verification evidence.')
  if ((m.unit === 'ms' && (m.value > SURVIVAL_LIMITS.activeMsMax || m.threshold > SURVIVAL_LIMITS.activeMsMax)) || ((m.unit === 'cv' || m.unit === 'ratio') && (m.value > SURVIVAL_LIMITS.cvMax || m.threshold > SURVIVAL_LIMITS.cvMax))) throw new InputError('Evidence is outside supported bounds.')
  if (m.reason === 'typing') {
    const stage = SURVIVAL_STAGES.find((s) => s.id === m.stage)!
    if (m.unit === 'wpm' ? m.threshold !== stage.typingMinWpm || m.value >= m.threshold : m.threshold !== stage.typingCv || m.value <= m.threshold) throw new InputError('Typing evidence does not meet its stage rule.')
  } else if (m.reason === 'pointer') {
    if (m.threshold !== SURVIVAL_STAGES.find((s) => s.id === m.stage)!.pointerRatio) throw new InputError('Pointer threshold does not match its stage.')
    if (m.value <= m.threshold && !/loop|revers/i.test(m.explanation)) throw new InputError('Structural pointer failure must be explained.')
  } else if (m.reason === 'scroll') {
    if (m.threshold !== SURVIVAL_STAGES.find((s) => s.id === m.stage)!.scrollCv) throw new InputError('Scroll threshold does not match its stage.')
    if (m.value <= m.threshold && !/revers/i.test(m.explanation)) throw new InputError('Structural scroll failure must be explained.')
  } else if (m.reason === 'idle' && m.threshold !== survivalStageAt(terminalMs).idleLimitMs) throw new InputError('Idle threshold does not match its stage.')
  if (m.reason === 'objective_deadline') {
    const validBudgets = [SURVIVAL_TIMING.admissionBudgetMs, SURVIVAL_STAGES.find((s) => s.id === m.stage)!.objectiveBudgetMs]
    if (!validBudgets.includes(m.threshold) || m.value <= m.threshold) throw new InputError('Invalid objective deadline evidence.')
  }
  if (m.reason === 'idle' && m.value < m.threshold) throw new InputError('Idle evidence is below its failure limit.')
  return m as unknown as SurvivalMeasurement
}
function trace(value: unknown): SurvivalPointerSample[] {
  if (!Array.isArray(value) || value.length < 6 || value.length > SURVIVAL_LIMITS.pointerTraceMaxSamples) throw new InputError('Invalid pointer trace size.')
  let previous = -1
  return value.map((item) => {
    const p = object(item); exact(p, ['x', 'y', 't'])
    if (!finite(p.x) || p.x < 0 || p.x > 1 || !finite(p.y) || p.y < 0 || p.y > 1 || !finite(p.t) || p.t < 0 || p.t > 750 || p.t <= previous || (previous < 0 && p.t !== 0)) throw new InputError('Invalid pointer trace sample.')
    previous = p.t
    return { x: p.x, y: p.y, t: p.t }
  })
}
export async function readFinish(req: Request, runId: string) {
  const body = await boundedBody(req, SURVIVAL_LIMITS.finishBodyBytes)
  exact(body, ['requestId', 'snapshot'])
  const request = requestId(body.requestId)
  const s = object(body.snapshot)
  if (s.status === 'failed') exact(s, ['runId', 'rulesVersion', 'inputMode', 'activeMs', 'stage', 'completedObjectiveIds', 'status', 'primaryReason', 'measurements', ...('pointerTrace' in s ? ['pointerTrace'] : [])])
  else if (s.status === 'interrupted') exact(s, ['runId', 'rulesVersion', 'inputMode', 'activeMs', 'stage', 'completedObjectiveIds', 'status', 'interruption', 'measurements'])
  else throw new InputError('Invalid terminal status.')
  id(runId, 'run ID'); id(s.runId, 'run ID')
  if (s.runId !== runId || s.rulesVersion !== SURVIVAL_RULES_VERSION || typeof s.inputMode !== 'string' || !modes.has(s.inputMode)) throw new InputError('Snapshot does not match the run contract.')
  if (!finite(s.activeMs) || s.activeMs < 0 || s.activeMs > SURVIVAL_LIMITS.activeMsMax || s.stage !== survivalStageAt(s.activeMs).id) throw new InputError('Invalid terminal time or stage.')
  if (!Array.isArray(s.completedObjectiveIds) || s.completedObjectiveIds.length > SURVIVAL_LIMITS.objectivesMax) throw new InputError('Invalid completed objectives.')
  const completed = s.completedObjectiveIds.map((v) => id(v, 'objective ID'))
  if (new Set(completed).size !== completed.length) throw new InputError('Duplicate completed objective IDs.')
  let normalized: SurvivalTerminalSnapshot
  if (s.status === 'interrupted') {
    if (!['reload', 'closed'].includes(String(s.interruption)) || !Array.isArray(s.measurements) || s.measurements.length !== 0) throw new InputError('Invalid interruption snapshot.')
    normalized = { runId, rulesVersion: SURVIVAL_RULES_VERSION, inputMode: s.inputMode as SurvivalInputMode, activeMs: s.activeMs, stage: s.stage as SurvivalTerminalSnapshot['stage'], completedObjectiveIds: completed, status: 'interrupted', interruption: s.interruption as 'reload' | 'closed', measurements: [] }
  } else {
    if (typeof s.primaryReason !== 'string' || !reasons.has(s.primaryReason) || !Array.isArray(s.measurements) || s.measurements.length < 1 || s.measurements.length > SURVIVAL_LIMITS.measurementsMax) throw new InputError('Invalid failure evidence.')
    const ms = s.measurements.map((m) => measurement(m, s.activeMs as number))
    if (new Set(ms.map((m) => m.reason)).size !== ms.length || ms[0].reason !== s.primaryReason) throw new InputError('Failure evidence order is invalid.')
    const sorted = [...ms].sort((a, b) => SURVIVAL_FAILURE_PRECEDENCE.indexOf(a.reason) - SURVIVAL_FAILURE_PRECEDENCE.indexOf(b.reason))
    if (ms.some((m, i) => m.reason !== sorted[i].reason)) throw new InputError('Failure evidence order is invalid.')
    const pointerTrace = s.pointerTrace === undefined ? undefined : trace(s.pointerTrace)
    if (pointerTrace && !ms.some((m) => m.reason === 'pointer')) throw new InputError('Pointer trace requires pointer evidence.')
    normalized = { runId, rulesVersion: SURVIVAL_RULES_VERSION, inputMode: s.inputMode as SurvivalInputMode, activeMs: s.activeMs, stage: s.stage as SurvivalTerminalSnapshot['stage'], completedObjectiveIds: completed, status: 'failed', primaryReason: s.primaryReason as SurvivalFailureReason, measurements: ms, ...(pointerTrace ? { pointerTrace } : {}) }
  }
  return { requestId: request, snapshot: normalized }
}
export function startRun(input: Awaited<ReturnType<typeof readStart>>) {
  return operation(input.requestId, 'survival-start', input, () => {
    const runId = randomUUID()
    const startedAt = new Date().toISOString()
    getDb().prepare('insert into game_runs (id,rules_version,input_mode,started_at) values (?,?,?,?)').run(runId, input.rulesVersion, input.inputMode, startedAt)
    return { ...input, ok: true as const, runId, startedAt }
  })
}
export function bindRun(runId: string, input: Awaited<ReturnType<typeof readBind>>) {
  const db = getDb()
  return operation(input.requestId, 'survival-bind', { runId, ...input }, () => {
    const run = db.prepare('select user_id from game_runs where id=?').get(runId) as { user_id: number | null } | undefined
    if (!run) throw new InputError('Run not found.', 404)
    const user = db.prepare('select id,handle from users where handle=?').get(input.handle) as { id: number; handle: string } | undefined
    if (!user) throw new InputError('Verified identity not found.', 403)
    if (run.user_id !== null && run.user_id !== user.id) throw new InputError('Run is already bound to another identity.', 409)
    db.prepare('update game_runs set user_id=? where id=? and user_id is null').run(user.id, runId)
    return { ok: true as const, requestId: input.requestId, runId, user: { id: user.id, handle: user.handle } }
  })
}
export function finishRun(runId: string, request: Awaited<ReturnType<typeof readFinish>>) {
  const db = getDb(); const snapshot = request.snapshot
  return operation(request.requestId, 'survival-finish', { requestId: request.requestId, snapshot }, () => {
    const run = db.prepare('select rules_version,input_mode,user_id,terminal_status from game_runs where id=?').get(runId) as { rules_version: string; input_mode: string; user_id: number | null; terminal_status: string | null } | undefined
    if (!run) throw new InputError('Run not found.', 404)
    if (run.terminal_status) throw new InputError('Run already has a terminal result.', 409)
    if (run.rules_version !== snapshot.rulesVersion || run.input_mode !== snapshot.inputMode) throw new InputError('Snapshot does not match run settings.', 409)
    const stored = (db.prepare('select objective_id from game_objective_events where run_id=?').all(runId) as { objective_id: string }[]).map((r) => r.objective_id)
    const supplied = [...snapshot.completedObjectiveIds]
    if (stored.length !== supplied.length || stored.some((v) => !supplied.includes(v))) throw new InputError('Completed objectives do not match persisted receipts.', 409)
    const primary = snapshot.status === 'failed' ? snapshot.primaryReason : null
    const receipt = { ok: true as const, requestId: request.requestId, runId, resultId: runId, ranked: Boolean(run.user_id && snapshot.status === 'failed'), recordedAt: new Date().toISOString() }
    const result = db.prepare('update game_runs set terminal_status=?,active_ms=?,completed_objectives=?,primary_reason=?,snapshot_json=?,finished_at=? where id=? and terminal_status is null')
      .run(snapshot.status, snapshot.activeMs, stored.length, primary, JSON.stringify(snapshot), receipt.recordedAt, runId)
    if (Number(result.changes) !== 1) throw new InputError('Run already has a terminal result.', 409)
    return receipt
  })
}
export function routeError(error: unknown) { return errorResponse(error) }
