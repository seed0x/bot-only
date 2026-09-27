import { requireActiveDesignation } from '../detections'
import { randomBytes } from 'node:crypto'
import { getDb } from '../db'
import { operation } from '../operations'
import { handleInput, InputError, object, requestId } from '../server-input'
import type {
  SessionUser, SurvivalBindReceipt, SurvivalBindRequest, SurvivalFailureReason, SurvivalFinishReceipt,
  SurvivalFinishRequest, SurvivalInputMode, SurvivalMeasurement, SurvivalPointerSample, SurvivalScoreRow,
  SurvivalScoresResponse, SurvivalStageId, SurvivalStartReceipt, SurvivalStartRequest, SurvivalTerminalSnapshot,
} from '../types'
import {
  SURVIVAL_FAILURE_PRECEDENCE, SURVIVAL_ID_PATTERN, SURVIVAL_LIMITS, SURVIVAL_RULES_VERSION,
  SURVIVAL_SENSORS, SURVIVAL_STAGES, SURVIVAL_TIMING, survivalStageAt,
} from './config'

// G05 server side of the versioned survival contract: run start, identity binding, the one
// terminal write per run, and the best-run-per-identity ranking. Routes only parse and delegate.

const KNOWN_RULES_VERSIONS: readonly string[] = [SURVIVAL_RULES_VERSION]
const STAGE_IDS: readonly SurvivalStageId[] = SURVIVAL_STAGES.map(stage => stage.id)
const UNITS: Readonly<Record<SurvivalFailureReason, SurvivalMeasurement['unit']>> = {
  verification_failed: 'boolean', objective_deadline: 'ms', idle: 'ms', pointer: 'ratio', typing: 'cv', scroll: 'cv',
}
export const SURVIVAL_SCORES_LIMIT = 100

/** Reads a JSON object body, enforcing the UTF-8 byte limit before parsing. */
export async function readBody(req: Request, limit: number): Promise<Record<string, unknown>> {
  const bytes = await req.arrayBuffer()
  if (bytes.byteLength > limit) throw new InputError('Request too large.', 413)
  let raw: string
  try { raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { throw new InputError('Invalid JSON.') }
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new InputError('Invalid JSON.') }
  return object(parsed)
}

function exact(value: unknown, required: readonly string[], optional: readonly string[] = []) {
  const record = object(value)
  for (const key of Object.keys(record)) if (!required.includes(key) && !optional.includes(key)) throw new InputError(`Unknown field: ${key}.`)
  for (const key of required) if (!Object.hasOwn(record, key)) throw new InputError(`Missing field: ${key}.`)
  return record
}
export function survivalId(value: unknown, name = 'ID') {
  if (typeof value !== 'string' || !SURVIVAL_ID_PATTERN.test(value)) throw new InputError(`A valid ${name} is required.`)
  return value
}
function rulesVersion(value: unknown) {
  if (typeof value !== 'string' || !KNOWN_RULES_VERSIONS.includes(value)) throw new InputError('Unknown rules version.')
  return value
}
function inputMode(value: unknown): SurvivalInputMode {
  if (value !== 'pointer' && value !== 'touch_or_keyboard') throw new InputError('Input mode must be pointer or touch_or_keyboard.')
  return value
}
function stageId(value: unknown): SurvivalStageId {
  if (!STAGE_IDS.includes(value as SurvivalStageId)) throw new InputError('Unknown stage.')
  return value as SurvivalStageId
}
function failureReason(value: unknown): SurvivalFailureReason {
  if (!(SURVIVAL_FAILURE_PRECEDENCE as readonly unknown[]).includes(value)) throw new InputError('Unknown failure reason.')
  return value as SurvivalFailureReason
}
function bounded(value: unknown, min: number, max: number, name: string) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new InputError(`${name} must be a finite number from ${min} to ${max}.`)
  return value
}
const stageConfig = (id: SurvivalStageId) => SURVIVAL_STAGES[STAGE_IDS.indexOf(id)]
// Budget thresholds are deadline minus issue time in the engine, so allow float rounding only.
const sameMs = (a: number, b: number) => Math.abs(a - b) <= 1e-6

export function parseStart(body: unknown): SurvivalStartRequest {
  const input = exact(body, ['requestId', 'rulesVersion', 'inputMode'])
  return { requestId: requestId(input.requestId), rulesVersion: rulesVersion(input.rulesVersion), inputMode: inputMode(input.inputMode) }
}

export function startRun(input: SurvivalStartRequest): SurvivalStartReceipt {
  return operation(input.requestId, 'survival.start', { rulesVersion: input.rulesVersion, inputMode: input.inputMode }, () => {
    const runId = 'run_' + randomBytes(16).toString('hex'), startedAt = new Date().toISOString()
    getDb().prepare('insert into game_runs (id, rules_version, input_mode, started_at) values (?, ?, ?, ?)')
      .run(runId, input.rulesVersion, input.inputMode, startedAt)
    return { ok: true, requestId: input.requestId, rulesVersion: input.rulesVersion, inputMode: input.inputMode, runId, startedAt }
  })
}

export function parseBind(body: unknown): SurvivalBindRequest {
  const input = exact(body, ['requestId', 'handle'])
  return { requestId: requestId(input.requestId), handle: handleInput(input.handle) }
}

/** `admitted` is the identity from the HttpOnly admission cookie, never from the body. */
export function bindRun(runId: string, input: SurvivalBindRequest, admitted: SessionUser | null): SurvivalBindReceipt {
  if (!admitted) throw new InputError('Pass verification before binding a run.', 403)
  if (admitted.handle !== input.handle) throw new InputError('This browser is admitted as a different unit.', 403)
  const user = { id: admitted.id, handle: admitted.handle }
  return operation(input.requestId, 'survival.bind', { runId, handle: input.handle }, () => {
    requireActiveDesignation(input.handle)
    const db = getDb()
    const run = db.prepare('select user_id, terminal_status from game_runs where id = ?').get(runId) as { user_id: number | null; terminal_status: string | null } | undefined
    if (!run) throw new InputError('Run not found.', 404)
    if (run.user_id !== null && run.user_id !== user.id) throw new InputError('Run is bound to another unit.', 409)
    if (run.user_id === null) {
      if (run.terminal_status !== null) throw new InputError('Run already ended.', 409)
      db.prepare('update game_runs set user_id = ? where id = ? and user_id is null and terminal_status is null').run(user.id, runId)
    }
    return { ok: true, requestId: input.requestId, runId, user }
  })
}

function objectiveIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > SURVIVAL_LIMITS.objectivesMax) throw new InputError(`Completed objectives must be a list of at most ${SURVIVAL_LIMITS.objectivesMax}.`)
  const ids = value.map(id => survivalId(id, 'objective ID'))
  if (new Set(ids).size !== ids.length) throw new InputError('Completed objective IDs must be unique.')
  return ids
}

function measurements(value: unknown, activeMs: number, terminalStage: SurvivalStageId): SurvivalMeasurement[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > SURVIVAL_LIMITS.measurementsMax) throw new InputError(`A failed run needs 1–${SURVIVAL_LIMITS.measurementsMax} measurements.`)
  let previous = -1
  return value.map(item => {
    const input = exact(item, ['reason', 'activeMs', 'stage', 'value', 'threshold', 'unit', 'explanation'])
    const reason = failureReason(input.reason), precedence = SURVIVAL_FAILURE_PRECEDENCE.indexOf(reason)
    if (precedence <= previous) throw new InputError('Measurements must be unique and in failure precedence order.')
    previous = precedence
    if (input.activeMs !== activeMs) throw new InputError('Measurement active time must equal the terminal active time.')
    const stage = stageId(input.stage)
    const terminalOnly = reason === 'idle' || reason === 'verification_failed'
    if (terminalOnly ? stage !== terminalStage : STAGE_IDS.indexOf(stage) > STAGE_IDS.indexOf(terminalStage)) throw new InputError(`The ${reason} measurement stage does not fit this run.`)
    const unit = reason === 'typing' && input.unit === 'wpm' ? 'wpm' : UNITS[reason]
    if (input.unit !== unit) throw new InputError(`The ${reason} measurement unit is ${unit}.`)
    const max = unit === 'ms' ? SURVIVAL_LIMITS.activeMsMax : unit === 'boolean' ? 1 : SURVIVAL_LIMITS.cvMax
    const measured = bounded(input.value, 0, max, 'Measurement value'), threshold = bounded(input.threshold, 0, max, 'Measurement threshold')
    const config = stageConfig(stage)
    const thresholdOk = reason === 'verification_failed' ? measured === 1 && threshold === 0
      : reason === 'objective_deadline' ? sameMs(threshold, config.objectiveBudgetMs) || sameMs(threshold, SURVIVAL_TIMING.admissionBudgetMs)
      : threshold === (reason === 'idle' ? config.idleLimitMs : reason === 'pointer' ? config.pointerRatio : reason === 'typing' ? (unit === 'wpm' ? config.typingMinWpm : config.typingCv) : config.scrollCv)
    if (!thresholdOk) throw new InputError(`The ${reason} threshold does not match survival rules for its stage.`)
    if (reason === 'typing' && (unit === 'wpm' ? measured >= threshold : measured <= threshold)) throw new InputError('Typing evidence does not meet its stage rule.')
    const explanation = input.explanation
    const length = typeof explanation === 'string' ? [...explanation].length : 0
    if (typeof explanation !== 'string' || length < 1 || length > SURVIVAL_LIMITS.explanationMaxLength) throw new InputError(`Explanation must be 1–${SURVIVAL_LIMITS.explanationMaxLength} characters.`)
    return { reason, activeMs, stage, value: measured, threshold, unit, explanation }
  })
}

function pointerTrace(value: unknown): SurvivalPointerSample[] {
  if (!Array.isArray(value) || value.length < SURVIVAL_SENSORS.pointerMinSamples || value.length > SURVIVAL_LIMITS.pointerTraceMaxSamples) {
    throw new InputError(`A pointer trace has ${SURVIVAL_SENSORS.pointerMinSamples}–${SURVIVAL_LIMITS.pointerTraceMaxSamples} samples.`)
  }
  let previous = -1
  return value.map((item, index) => {
    const input = exact(item, ['x', 'y', 't'])
    const x = bounded(input.x, SURVIVAL_LIMITS.normalizedCoordinateMin, SURVIVAL_LIMITS.normalizedCoordinateMax, 'Trace x')
    const y = bounded(input.y, SURVIVAL_LIMITS.normalizedCoordinateMin, SURVIVAL_LIMITS.normalizedCoordinateMax, 'Trace y')
    const t = bounded(input.t, 0, SURVIVAL_SENSORS.pointerWindowMs, 'Trace time')
    if (index === 0 ? t !== 0 : t <= previous) throw new InputError('Trace time must start at zero and strictly increase.')
    previous = t
    return { x, y, t }
  })
}

// Rebuilds the snapshot field by field, so the stored JSON and the replay fingerprint have one normalized order.
function snapshot(runId: string, value: unknown): SurvivalTerminalSnapshot {
  const base = ['runId', 'rulesVersion', 'inputMode', 'activeMs', 'stage', 'completedObjectiveIds', 'status', 'measurements']
  const status = object(value).status
  if (status !== 'failed' && status !== 'interrupted') throw new InputError('Only failed or interrupted runs can finish.')
  const input = status === 'failed' ? exact(value, [...base, 'primaryReason'], ['pointerTrace']) : exact(value, [...base, 'interruption'])
  if (survivalId(input.runId, 'run ID') !== runId) throw new InputError('Snapshot run ID does not match the URL.')
  const activeMs = bounded(input.activeMs, 0, SURVIVAL_LIMITS.activeMsMax, 'Active time')
  const stage = survivalStageAt(activeMs).id
  if (input.stage !== stage) throw new InputError('Stage does not match the active time.')
  const common = { runId, rulesVersion: rulesVersion(input.rulesVersion), inputMode: inputMode(input.inputMode), activeMs, stage, completedObjectiveIds: objectiveIds(input.completedObjectiveIds) }
  if (status === 'interrupted') {
    if (input.interruption !== 'reload' && input.interruption !== 'closed') throw new InputError('Interruption must be reload or closed.')
    if (!Array.isArray(input.measurements) || input.measurements.length) throw new InputError('Interrupted runs carry no measurements.')
    return { ...common, status, interruption: input.interruption, measurements: [] }
  }
  const primaryReason = failureReason(input.primaryReason)
  const evidence = measurements(input.measurements, activeMs, stage)
  if (evidence[0].reason !== primaryReason) throw new InputError('The primary reason must be the first measurement.')
  if (!Object.hasOwn(input, 'pointerTrace')) return { ...common, status, primaryReason, measurements: evidence }
  if (!evidence.some(item => item.reason === 'pointer')) throw new InputError('A pointer trace needs a pointer measurement.')
  return { ...common, status, primaryReason, measurements: evidence, pointerTrace: pointerTrace(input.pointerTrace) }
}

export function parseFinish(runId: string, body: unknown): SurvivalFinishRequest {
  const input = exact(body, ['requestId', 'snapshot'])
  return { requestId: requestId(input.requestId), snapshot: snapshot(runId, input.snapshot) }
}

/** One terminal write per run. `admitted` must match a bound run's identity. */
export function finishRun(input: SurvivalFinishRequest, admitted: SessionUser | null): SurvivalFinishReceipt {
  const { requestId: id, snapshot: result } = input
  // Check identity before looking up an idempotent receipt, too.
  const owner = getDb().prepare('select user_id from game_runs where id = ?').get(result.runId) as { user_id: number | null } | undefined
  if (owner?.user_id != null && owner.user_id !== admitted?.id) throw new InputError('Only the bound unit can save this run.', 403)
  return operation(id, 'survival.finish', result, () => {
    const db = getDb()
    const run = db.prepare('select rules_version, input_mode, user_id, terminal_status from game_runs where id = ?').get(result.runId) as
      { rules_version: string; input_mode: string; user_id: number | null; terminal_status: string | null } | undefined
    if (!run) throw new InputError('Run not found.', 404)
    if (run.terminal_status !== null) throw new InputError('This run already has a saved result.', 409)
    if (run.user_id !== null && run.user_id !== admitted?.id) throw new InputError('Only the bound unit can save this run.', 403)
    if (run.rules_version !== result.rulesVersion || run.input_mode !== result.inputMode) throw new InputError('Rules version or input mode differs from the run start.', 409)
    const recorded = (db.prepare('select objective_id from game_objective_events where run_id = ?').all(result.runId) as { objective_id: string }[]).map(row => row.objective_id)
    const claimed = new Set(result.completedObjectiveIds)
    if (recorded.length !== claimed.size || recorded.some(objective => !claimed.has(objective))) throw new InputError('Completed objectives differ from the recorded completions.', 409)
    const recordedAt = new Date().toISOString()
    db.prepare(`update game_runs set terminal_status = ?, active_ms = ?, completed_objectives = ?, primary_reason = ?, snapshot_json = ?, finished_at = ?
      where id = ? and terminal_status is null`).run(result.status, result.activeMs, recorded.length,
      result.status === 'failed' ? result.primaryReason : null, JSON.stringify(result), recordedAt, result.runId)
    return { ok: true, requestId: id, runId: result.runId, resultId: result.runId, ranked: result.status === 'failed' && run.user_id !== null, recordedAt }
  })
}

export type SurvivalScoreQuery = Readonly<{ rulesVersion: string; inputMode: SurvivalInputMode }>
export function parseScoreQuery(params: URLSearchParams): SurvivalScoreQuery {
  for (const key of new Set(params.keys())) if (key !== 'inputMode' && key !== 'rulesVersion') throw new InputError(`Unknown filter: ${key}.`)
  if (params.getAll('inputMode').length !== 1 || params.getAll('rulesVersion').length > 1) throw new InputError('Give exactly one inputMode and at most one rulesVersion.')
  return { inputMode: inputMode(params.get('inputMode')), rulesVersion: params.has('rulesVersion') ? rulesVersion(params.get('rulesVersion')) : SURVIVAL_RULES_VERSION }
}

/** One whole best run per identity; never combines maxima from different runs. */
export function survivalScores(query: SurvivalScoreQuery): SurvivalScoresResponse {
  const rows = getDb().prepare(`
    select runId, handle, activeMs, completedObjectives from (
      select r.id as runId, u.handle as handle, r.active_ms as activeMs, r.completed_objectives as completedObjectives,
             row_number() over (partition by r.user_id order by r.active_ms desc, r.completed_objectives desc, r.id asc) as pick
      from game_runs r join users u on u.id = r.user_id
      where r.rules_version = ? and r.input_mode = ? and r.terminal_status = 'failed' and r.user_id is not null
    ) where pick = 1
    order by activeMs desc, completedObjectives desc, handle collate binary asc, runId asc
    limit ?
  `).all(query.rulesVersion, query.inputMode, SURVIVAL_SCORES_LIMIT) as { runId: string; handle: string; activeMs: number; completedObjectives: number }[]
  const scores: SurvivalScoreRow[] = rows.map(row => ({
    runId: row.runId, handle: row.handle, activeMs: row.activeMs, completedObjectives: row.completedObjectives,
    roundsSurvived: Math.floor(row.activeMs / SURVIVAL_TIMING.roundMs), stage: survivalStageAt(row.activeMs).id,
  }))
  return { rulesVersion: query.rulesVersion, inputMode: query.inputMode, scores }
}
