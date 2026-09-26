import type {
  SurvivalEvent, SurvivalRunState, SurvivalMeasurement, SurvivalTerminalSnapshot,
  SurvivalDetector, SurvivalObjective, SurvivalObjectiveSubmission,
} from '../types'
import {
  SURVIVAL_RULES_VERSION, SURVIVAL_STAGES, SURVIVAL_TIMING,
  SURVIVAL_FAILURE_PRECEDENCE, SURVIVAL_LIMITS, survivalStageAt,
} from './config'

export type SurvivalTransition = Readonly<{
  state: SurvivalRunState
  // The adapter must discard partial windows; qualified counts stay in state.
  resetDetectors: readonly SurvivalDetector[]
}>
const detectors: readonly SurvivalDetector[] = ['pointer', 'typing', 'scroll']

function freezeState(state: SurvivalRunState): SurvivalRunState {
  return Object.freeze({ ...state,
    pauseReasons: Object.freeze([...state.pauseReasons]),
    completedObjectiveIds: Object.freeze([...state.completedObjectiveIds]),
    badWindows: Object.freeze({ ...state.badWindows }),
  })
}
export function createSurvivalState(): SurvivalRunState {
  return freezeState({ phase: 'ready', run: null, user: null, activeMs: 0,
    idleElapsedMs: 0, lastEventAtMs: null, countdownEndsAtMs: null,
    pauseReasons: [], objective: null, pendingObjective: null,
    completedObjectiveIds: [], badWindows: { pointer: 0, typing: 0, scroll: 0 }, terminal: null })
}

export function survivalIdleWarning(state: SurvivalRunState): boolean {
  return state.phase === 'running' && state.idleElapsedMs >=
    survivalStageAt(state.activeMs).idleLimitMs * SURVIVAL_TIMING.idleWarningFraction
}

function terminal(state: SurvivalRunState, measurements: readonly SurvivalMeasurement[]): SurvivalRunState {
  if (!state.run || !measurements.length) return state
  const ordered = [...measurements].sort((a, b) =>
    SURVIVAL_FAILURE_PRECEDENCE.indexOf(a.reason) - SURVIVAL_FAILURE_PRECEDENCE.indexOf(b.reason))
  const snapshot: SurvivalTerminalSnapshot = Object.freeze({
    runId: state.run.runId, rulesVersion: state.run.rulesVersion, inputMode: state.run.inputMode,
    activeMs: state.activeMs, stage: survivalStageAt(state.activeMs).id,
    completedObjectiveIds: Object.freeze([...state.completedObjectiveIds]),
    status: 'failed', primaryReason: ordered[0].reason,
    measurements: Object.freeze(ordered.map(item => Object.freeze({ ...item }))),
  })
  return { ...state, phase: 'ended', countdownEndsAtMs: null, terminal: snapshot }
}
function idleMeasurement(state: SurvivalRunState): SurvivalMeasurement {
  const stage = survivalStageAt(state.activeMs)
  return { reason: 'idle', activeMs: state.activeMs, stage: stage.id,
    value: state.idleElapsedMs, threshold: stage.idleLimitMs, unit: 'ms', explanation: 'No qualifying activity before the idle limit.' }
}

// Find the first idle limit crossing, including limits tightened at stage boundaries.
function idleFailureAt(state: SurvivalRunState, target: number): number | null {
  for (let i = 0; i < SURVIVAL_STAGES.length; i++) {
    const stage = SURVIVAL_STAGES[i]
    const start = Math.max(state.activeMs, stage.startsAtMs)
    const end = Math.min(target, SURVIVAL_STAGES[i + 1]?.startsAtMs ?? Infinity)
    if (start > end || (SURVIVAL_STAGES[i + 1] && start >= SURVIVAL_STAGES[i + 1].startsAtMs)) continue
    const crossing = Math.max(start, state.activeMs + stage.idleLimitMs - state.idleElapsedMs)
    // At the right edge, the next stage owns the limit.
    if (crossing <= end && crossing < (SURVIVAL_STAGES[i + 1]?.startsAtMs ?? Infinity)) return crossing
  }
  return null
}

function sameSubmission(a: SurvivalObjectiveSubmission, b: SurvivalObjectiveSubmission): boolean {
  return a.runId === b.runId && a.objectiveId === b.objectiveId && a.requestId === b.requestId &&
    a.kind === b.kind && a.submittedAtActiveMs === b.submittedAtActiveMs &&
    a.issuedAtActiveMs === b.issuedAtActiveMs && a.deadlineActiveMs === b.deadlineActiveMs && a.stage === b.stage
}
function matchesObjective(objective: SurvivalObjective, submission: SurvivalObjectiveSubmission): boolean {
  return objective.runId === submission.runId && objective.objectiveId === submission.objectiveId &&
    objective.kind === submission.kind && objective.stage === submission.stage &&
    objective.issuedAtActiveMs === submission.issuedAtActiveMs && objective.deadlineActiveMs === submission.deadlineActiveMs
}

/**
 * Reduce one timestamp atomically. Pass all events from the same browser timestamp
 * together to retain simultaneous evidence and apply failure precedence once.
 * Invalid/backwards timestamps throw before mutation. Async replies for old runs
 * are ignored, including their timestamp; they cannot advance the current run.
 */
export function transitionSurvival(state: SurvivalRunState, input: SurvivalEvent | readonly SurvivalEvent[]): SurvivalTransition {
  const events = Array.isArray(input) ? input as readonly SurvivalEvent[] : [input as SurvivalEvent]
  if (!events.length) return { state, resetDetectors: [] }
  const atMs = events[0].atMs
  if (!Number.isFinite(atMs) || atMs < 0 || events.some(event => event.atMs !== atMs)) throw new RangeError('Events require one nondecreasing monotonic timestamp.')
  if (events.some(event => event.type === 'new_run')) {
    if (state.lastEventAtMs !== null && atMs < state.lastEventAtMs) throw new RangeError('Backwards event timestamp.')
    if (events.length !== 1) throw new Error('New run must be a separate transition.')
    return { state: freezeState({ ...createSurvivalState(), lastEventAtMs: atMs }), resetDetectors: detectors }
  }
  if (state.phase === 'ended') return { state, resetDetectors: [] }
  const current = events.filter(event => {
    if ('runId' in event) return event.runId === state.run?.runId
    if ('receipt' in event && event.type !== 'start_acknowledged') return event.receipt.runId === state.run?.runId
    if ('submission' in event) return event.submission.runId === state.run?.runId
    if ('objective' in event) return event.objective.runId === state.run?.runId
    return true
  })
  if (!current.length) return { state, resetDetectors: [] }
  if (state.lastEventAtMs !== null && atMs < state.lastEventAtMs) throw new RangeError('Backwards event timestamp.')
  let next: SurvivalRunState = { ...state, lastEventAtMs: atMs }
  const resets = new Set<SurvivalDetector>()
  const resetAll = () => detectors.forEach(detector => resets.add(detector))
  const measurements = new Map<SurvivalMeasurement['reason'], SurvivalMeasurement>()
  const record = (measurement: SurvivalMeasurement) => measurements.set(measurement.reason, measurement)

  // Countdown finishes only via its explicit event: late delivery grants no credit
  // for time spent waiting for the browser to actually enter running.
  if (state.phase === 'running') {
    const delta = atMs - (state.lastEventAtMs ?? atMs)
    const target = state.activeMs + delta
    const idleAt = idleFailureAt(state, target)
    // Strict deadline equality needs the next representable active timestamp,
    // rather than a fixed epsilon that would vary with clock magnitude.
    let objectiveAt: number | null = null
    if (state.objective && !state.pendingObjective && target > state.objective.deadlineActiveMs) {
      const bytes = new ArrayBuffer(8)
      const view = new DataView(bytes)
      view.setFloat64(0, state.objective.deadlineActiveMs)
      view.setBigUint64(0, view.getBigUint64(0) + BigInt(1))
      objectiveAt = view.getFloat64(0)
    }
    const failureAt = Math.min(idleAt ?? target, objectiveAt ?? target)
    next = { ...next, activeMs: failureAt, idleElapsedMs: state.idleElapsedMs + failureAt - state.activeMs }
    if (idleAt === failureAt) record(idleMeasurement(next))
    if (objectiveAt === failureAt && state.objective) {
      record({ reason: 'objective_deadline', activeMs: failureAt, stage: state.objective.stage,
        value: failureAt - state.objective.issuedAtActiveMs,
        threshold: state.objective.deadlineActiveMs - state.objective.issuedAtActiveMs,
        unit: 'ms', explanation: 'The current objective was not submitted before its deadline.' })
    }
  }
  // An event later than an already crossed idle boundary cannot beat that failure.
  const crossedEarlier = next.activeMs < state.activeMs + (state.phase === 'running' ? atMs - (state.lastEventAtMs ?? atMs) : 0)
  for (const event of current) {
    if (crossedEarlier) break
    switch (event.type) {
      case 'start_acknowledged':
        if (next.phase !== 'ready') break
        if (event.receipt.rulesVersion !== SURVIVAL_RULES_VERSION) throw new Error('Unsupported survival rules version.')
        next = { ...next, run: Object.freeze({ ...event.receipt }),
          phase: next.pauseReasons.length ? 'paused' : 'countdown',
          countdownEndsAtMs: next.pauseReasons.length ? null : atMs + SURVIVAL_TIMING.countdownMs }
        resetAll()
        break
      case 'countdown_finished':
        if (next.phase === 'countdown' && next.countdownEndsAtMs !== null && atMs >= next.countdownEndsAtMs && !next.pauseReasons.length) {
          next = { ...next, phase: 'running', countdownEndsAtMs: null }
          resetAll()
        }
        break
      case 'pause_acquired':
        next = { ...next, pauseReasons: [...new Set([...next.pauseReasons, event.reason])],
          phase: next.phase === 'ready' ? 'ready' : 'paused', countdownEndsAtMs: null }
        resetAll()
        break
      case 'pause_released':
        // Objective request is owned by the request lifecycle, not a generic close.
        if (event.reason === 'objective_request' && next.pendingObjective) break
        next = { ...next, pauseReasons: next.pauseReasons.filter(reason => reason !== event.reason) }
        break
      case 'resume_requested':
        if (next.phase === 'paused' && !next.pauseReasons.length && !next.pendingObjective) {
          next = { ...next, phase: 'countdown', countdownEndsAtMs: atMs + SURVIVAL_TIMING.countdownMs }
          resetAll()
        }
        break
      case 'activity':
        if (state.phase === 'running' && !measurements.size) next = { ...next, idleElapsedMs: 0 }
        break
      case 'sensor_reset':
        if (event.detector) resets.add(event.detector)
        else resetAll()
        break
      case 'detector_evaluated': {
        if (state.phase !== 'running' || (event.result.detector === 'pointer' && next.run?.inputMode !== 'pointer')) break
        const result = event.result
        if (result.outcome === 'insufficient_data') break
        const windowStage = SURVIVAL_STAGES.find(stage => stage.id === result.stage)!
        if (!windowStage || windowStage.startsAtMs > next.activeMs || result.value === null || !Number.isFinite(result.value)) throw new Error('Invalid qualified detector result.')
        const count = result.outcome === 'good' ? 0 : next.badWindows[result.detector] + 1
        next = { ...next, badWindows: { ...next.badWindows, [result.detector]: count } }
        if (count >= windowStage.badWindowsToFail) record({ reason: result.detector,
          activeMs: next.activeMs, stage: result.stage, value: result.value, threshold: result.threshold,
          unit: result.detector === 'pointer' ? 'ratio' : result.typingMetric === 'speed' ? 'wpm' : 'cv', explanation: result.explanation })
        break
      }
      case 'objective_issued': {
        if (!next.run || next.pendingObjective || next.completedObjectiveIds.includes(event.objective.objectiveId)) break
        const objective = event.objective
        const stage = survivalStageAt(objective.issuedAtActiveMs)
        const budget = objective.kind === 'admission' ? SURVIVAL_TIMING.admissionBudgetMs : stage.objectiveBudgetMs
        if (objective.stage !== stage.id || objective.issuedAtActiveMs !== next.activeMs ||
          objective.deadlineActiveMs !== objective.issuedAtActiveMs + budget ||
          objective.eligiblePostIds.length > SURVIVAL_LIMITS.eligiblePostIdsMax ||
          (objective.kind === 'like' ? !objective.eligiblePostIds.length : !!objective.eligiblePostIds.length)) throw new Error('Invalid objective issue.')
        next = { ...next, objective: Object.freeze({ ...objective, eligiblePostIds: Object.freeze([...objective.eligiblePostIds]) }) }
        break
      }
      case 'objective_submitted': {
        if (next.pendingObjective) {
          if (!sameSubmission(next.pendingObjective, event.submission)) throw new Error('Pending objective payload is immutable.')
          break
        }
        if (state.phase !== 'running' || measurements.size || !next.objective) break
        if (!matchesObjective(next.objective, event.submission) || event.submission.submittedAtActiveMs !== next.activeMs) throw new Error('Submission does not match the active objective.')
        next = { ...next, pendingObjective: Object.freeze({ ...event.submission }), phase: 'paused', countdownEndsAtMs: null,
          pauseReasons: [...new Set([...next.pauseReasons, 'objective_request' as const])] }
        resetAll()
        break
      }
      case 'objective_acknowledged': {
        const pending = next.pendingObjective
        if (!pending || !next.objective || event.receipt.objectiveId !== pending.objectiveId ||
          event.receipt.requestId !== pending.requestId || event.receipt.action.kind !== pending.kind ||
          (next.user && next.user.id !== event.receipt.user.id)) break
        if (next.objective.kind === 'like' && event.receipt.action.kind === 'like' &&
          !next.objective.eligiblePostIds.includes(event.receipt.action.postId)) break
        next = { ...next, user: Object.freeze({ ...event.receipt.user }), pendingObjective: null, objective: null,
          completedObjectiveIds: [...next.completedObjectiveIds, pending.objectiveId],
          pauseReasons: next.pauseReasons.filter(reason => reason !== 'objective_request') }
        break
      }
      case 'objective_rejected':
        if (next.pendingObjective?.objectiveId === event.objectiveId && next.pendingObjective.requestId === event.requestId) {
          next = { ...next, pendingObjective: null, pauseReasons: next.pauseReasons.filter(reason => reason !== 'objective_request') }
        }
        break
      case 'objective_uncertain':
        // Deliberately retain payload, pause and budgets for explicit reconciliation.
        break
      case 'identity_bound':
        if (!next.user || next.user.id === event.receipt.user.id) next = { ...next, user: Object.freeze({ ...event.receipt.user }) }
        break
      case 'verification_rejected':
        if (next.run) record({ reason: 'verification_failed', activeMs: next.activeMs,
          stage: survivalStageAt(next.activeMs).id, value: 1, threshold: 0, unit: 'boolean', explanation: 'The server confirmed a failed admission attempt.' })
        break
      case 'interrupted':
        if (next.run && !measurements.size) {
          next = { ...next, phase: 'ended', countdownEndsAtMs: null, terminal: Object.freeze({
            runId: next.run.runId, rulesVersion: next.run.rulesVersion, inputMode: next.run.inputMode,
            activeMs: next.activeMs, stage: survivalStageAt(next.activeMs).id,
            completedObjectiveIds: Object.freeze([...next.completedObjectiveIds]),
            status: 'interrupted', interruption: event.cause, measurements: Object.freeze([]) as readonly [],
          }) }
        }
        break
      case 'tick': break
    }
  }
  if (measurements.size) {
    next = terminal(next, [...measurements.values()])
    // Store only the actual qualified failing pointer window, never caller-owned arrays.
    const pointer = current.find(event => event.type === 'detector_evaluated' && event.result.detector === 'pointer' && event.result.outcome === 'bad')
    if (measurements.has('pointer') && pointer?.type === 'detector_evaluated' && pointer.result.pointerTrace && next.terminal?.status === 'failed') {
      const trace = pointer.result.pointerTrace
      if (trace.length > SURVIVAL_LIMITS.pointerTraceMaxSamples) throw new Error('Pointer evidence exceeds its bound.')
      next = { ...next, terminal: Object.freeze({ ...next.terminal,
        pointerTrace: Object.freeze(trace.map(sample => Object.freeze({ ...sample }))) }) }
    }
  }
  if (next.phase === 'ended') resetAll()
  return { state: freezeState(next), resetDetectors: Object.freeze([...resets]) }
}
