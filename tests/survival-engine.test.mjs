import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
// Node's native TS runner needs extensions; the app uses bundler resolution.
// Resolve only the engine's config import without changing application settings.
const engineUrl = new URL('../src/lib/survival/engine.ts', import.meta.url).href
register('data:text/javascript,' + encodeURIComponent(`
  export function resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === './config' && context.parentURL === ${JSON.stringify(engineUrl)} ? './config.ts' : specifier, context)
  }
`), import.meta.url)
const { createSurvivalState, transitionSurvival, survivalIdleWarning } = await import(engineUrl)
import { survivalStageAt } from '../src/lib/survival/config.ts'

const runId = 'run_00000000000001'
const startReceipt = { ok: true, requestId: 'start_000000000001', runId, rulesVersion: 'survival-v3', inputMode: 'pointer', startedAt: '2026-09-26T00:00:00.000Z' }
const step = (state, type, atMs, fields = {}) => transitionSurvival(state, { type, atMs, ...fields }).state
const running = () => step(step(createSurvivalState(), 'start_acknowledged', 0, { receipt: startReceipt }), 'countdown_finished', 3000)
const activity = (state, atMs) => step(state, 'activity', atMs, { source: 'input' })
const objective = (state, kind = 'post') => ({ runId, objectiveId: 'objective_00000001', kind, issuedAtActiveMs: state.activeMs,
  deadlineActiveMs: state.activeMs + (kind === 'admission' ? 60000 : survivalStageAt(state.activeMs).objectiveBudgetMs),
  stage: survivalStageAt(state.activeMs).id, eligiblePostIds: [] })
const submission = obj => ({ ...obj, eligiblePostIds: undefined, requestId: 'action_00000000001', submittedAtActiveMs: obj.deadlineActiveMs })
const bad = (detector, stage = 'purge') => {
  const limits = survivalStageAt({ boot: 0, observe: 30000, inspect: 60000, audit: 90000, purge: 120000 }[stage])
  return { detector, stage, outcome: 'bad', value: 1,
    threshold: detector === 'pointer' ? limits.pointerRatio : detector === 'typing' ? limits.typingCv : limits.scrollCv,
    explanation: 'Actual bad window.' }
}
function keptAlive(until) {
  let state = running()
  for (let time = 4000; time <= until; time += 1000) state = activity(state, time)
  return state
}

test('countdown grants no survival credit, including late delivery', () => {
  let state = step(createSurvivalState(), 'start_acknowledged', 100, { receipt: startReceipt })
  state = step(state, 'countdown_finished', 3099)
  assert.equal(state.phase, 'countdown')
  state = step(state, 'tick', 5000)
  assert.equal(state.activeMs, 0)
  state = step(state, 'countdown_finished', 5100)
  assert.equal(state.phase, 'running')
  assert.equal(step(state, 'tick', 5200).activeMs, 100)
})
test('stage progression uses active time across all five boundaries', () => {
  let state = running()
  for (let time = 4000; time <= 125000; time += 1000) {
    state = activity(state, time)
    assert.equal(state.phase, 'running')
    if ([33000, 63000, 93000, 123000].includes(time)) {
      assert.equal(survivalStageAt(state.activeMs).startsAtMs, time - 3000)
    }
  }
  assert.equal(survivalStageAt(state.activeMs).id, 'purge')
})
test('idle warns at 75 percent and fails at equality before activity can rescue it', () => {
  const initial = running()
  assert.equal(survivalIdleWarning(step(initial, 'tick', 11999)), false)
  const warning = step(initial, 'tick', 12000)
  assert.equal(survivalIdleWarning(warning), true)
  assert.equal(step(initial, 'tick', 14999).phase, 'running')
  const failed = activity(initial, 15000)
  assert.equal(failed.phase, 'ended')
  assert.equal(failed.terminal.primaryReason, 'idle')
  assert.equal(failed.activeMs, 12000)
  assert.equal(failed.idleElapsedMs, 12000)
  assert.equal(step(initial, 'tick', 99999).activeMs, 12000)
})
test('idle limit tightens immediately at stage boundary', () => {
  let state = keptAlive(22000) // 19 seconds of play; last activity at 19s
  state = step(state, 'tick', 32999)
  assert.equal(state.phase, 'running')
  state = step(state, 'tick', 33000)
  assert.equal(state.terminal.primaryReason, 'idle')
  assert.equal(state.activeMs, 30000)
  assert.equal(state.terminal.measurements[0].threshold, 10000)
  assert.equal(state.terminal.measurements[0].value, 11000)
})
test('overlapping pauses are a set, preserve budgets and require explicit Resume', () => {
  let state = step(running(), 'tick', 8000)
  state = step(state, 'objective_issued', 8000, { objective: objective(state) })
  const deadline = state.objective.deadlineActiveMs
  state = step(state, 'pause_acquired', 8000, { reason: 'leaderboard' })
  state = step(state, 'pause_acquired', 9000, { reason: 'hidden' })
  state = step(state, 'pause_acquired', 10000, { reason: 'hidden' })
  assert.equal(state.pauseReasons.length, 2)
  state = step(state, 'pause_released', 90000, { reason: 'leaderboard' })
  state = step(state, 'resume_requested', 90000)
  assert.equal(state.phase, 'paused')
  state = step(state, 'pause_released', 100000, { reason: 'hidden' })
  assert.equal(state.phase, 'paused')
  state = step(state, 'resume_requested', 100001)
  assert.equal(state.phase, 'countdown')
  state = step(state, 'countdown_finished', 103001)
  assert.equal(state.activeMs, 5000)
  assert.equal(state.idleElapsedMs, 5000)
  assert.equal(state.objective.deadlineActiveMs, deadline)
  state = step(state, 'tick', 104001)
  assert.equal(state.activeMs, 6000)
})
test('pause during countdown cancels it and Resume restarts all three seconds', () => {
  let state = step(createSurvivalState(), 'start_acknowledged', 0, { receipt: startReceipt })
  state = step(state, 'pause_acquired', 1000, { reason: 'blurred' })
  assert.equal(state.countdownEndsAtMs, null)
  state = step(state, 'pause_released', 10000, { reason: 'blurred' })
  state = step(state, 'resume_requested', 10000)
  assert.equal(state.countdownEndsAtMs, 13000)
  assert.equal(step(state, 'countdown_finished', 12999).phase, 'countdown')
})
test('qualified counts persist through reset/pause; insufficient does not reset', () => {
  let state = running()
  state = step(state, 'detector_evaluated', 3000, { result: bad('typing', 'boot') })
  state = step(state, 'sensor_reset', 3000, { cause: 'route' })
  state = step(state, 'detector_evaluated', 3000, { result: { ...bad('typing', 'boot'), outcome: 'insufficient_data', value: null } })
  assert.equal(state.badWindows.typing, 1)
  state = step(state, 'pause_acquired', 3000, { reason: 'leaderboard' })
  state = step(state, 'detector_evaluated', 3000, { result: bad('typing', 'boot') })
  assert.equal(state.badWindows.typing, 1)
  state = step(state, 'pause_released', 3000, { reason: 'leaderboard' })
  state = step(state, 'resume_requested', 3000)
  state = step(state, 'countdown_finished', 6000)
  state = step(state, 'detector_evaluated', 6000, { result: { ...bad('typing', 'boot'), outcome: 'good' } })
  assert.equal(state.badWindows.typing, 0)
  assert.deepEqual(transitionSurvival(state, { type: 'sensor_reset', atMs: 6000, cause: 'resize', detector: 'pointer' }).resetDetectors, ['pointer'])
})
test('simultaneous failures retain evidence and choose frozen precedence independent of event order', () => {
  const state = keptAlive(123000)
  const events = [
    { type: 'detector_evaluated', atMs: 127000, result: bad('scroll') },
    { type: 'detector_evaluated', atMs: 127000, result: bad('typing') },
    { type: 'detector_evaluated', atMs: 127000, result: bad('pointer') },
    { type: 'verification_rejected', atMs: 127000, runId, attemptId: 7 },
  ]
  for (const batch of [events, events.toReversed()]) {
    const failed = transitionSurvival(state, batch).state
    assert.equal(failed.terminal.primaryReason, 'verification_failed')
    assert.deepEqual(failed.terminal.measurements.map(m => m.reason), ['verification_failed', 'idle', 'pointer', 'typing', 'scroll'])
  }
})
test('an earlier idle crossing wins over later verification response', () => {
  const state = step(running(), 'verification_rejected', 16000, { runId, attemptId: 7 })
  assert.equal(state.terminal.primaryReason, 'idle')
  assert.equal(state.activeMs, 12000)
})
test('terminal state is immutable and late receipts cannot resurrect it; new run resets', () => {
  const ended = step(running(), 'tick', 15000)
  assert.ok(Object.isFrozen(ended.terminal))
  assert.ok(Object.isFrozen(ended.terminal.measurements[0]))
  assert.strictEqual(step(ended, 'activity', 20000, { source: 'input' }), ended)
  assert.strictEqual(step(ended, 'verification_rejected', 20000, { runId, attemptId: 8 }), ended)
  const fresh = step(ended, 'new_run', 20000)
  assert.equal(fresh.phase, 'ready')
  assert.equal(fresh.run, null)
  assert.equal(fresh.terminal, null)
  assert.equal(fresh.activeMs, 0)
  assert.deepEqual(fresh.badWindows, { pointer: 0, typing: 0, scroll: 0 })
})
test('invalid/backwards/mixed timestamps reject without mutating state', () => {
  const state = running()
  for (const atMs of [-1, NaN, Infinity, 2999]) assert.throws(() => step(state, 'tick', atMs), RangeError)
  assert.throws(() => transitionSurvival(state, [{ type: 'tick', atMs: 3000 }, { type: 'tick', atMs: 3001 }]), RangeError)
  assert.equal(state.activeMs, 0)
})
test('stale run replies do not advance or change the current run', () => {
  const state = running()
  for (const atMs of [1, 99999]) assert.strictEqual(step(state, 'verification_rejected', atMs, { runId: 'old_run_000000001', attemptId: 7 }), state)
})
test('objective exact deadline submits on time; uncertain retry pauses without score', () => {
  let state = running()
  const obj = objective(state)
  state = step(state, 'objective_issued', 3000, { objective: obj })
  for (let time = 4000; time <= 38000; time += 1000) state = activity(state, time)
  const payload = submission(obj)
  state = step(state, 'objective_submitted', 38000, { submission: payload })
  assert.equal(state.phase, 'paused')
  assert.equal(state.activeMs, 35000)
  state = step(state, 'objective_uncertain', 50000, { runId, objectiveId: obj.objectiveId, requestId: payload.requestId, message: 'Network unavailable.' })
  state = step(state, 'pause_released', 51000, { reason: 'objective_request' })
  assert.ok(state.pauseReasons.includes('objective_request'))
  state = step(state, 'objective_submitted', 52000, { submission: payload })
  assert.equal(state.activeMs, 35000)
  assert.throws(() => step(state, 'objective_submitted', 53000, { submission: { ...payload, requestId: 'changed_000000001' } }))
  const receipt = { runId, objectiveId: obj.objectiveId, requestId: payload.requestId,
    completionId: 'completion_000001', user: { id: 1, handle: 'unit' }, action: { kind: 'post', postId: 1 }, recordedAt: startReceipt.startedAt }
  const hidden = step(state, 'pause_acquired', 53000, { reason: 'hidden' })
  const acknowledgedHidden = step(hidden, 'objective_acknowledged', 54000, { receipt })
  assert.equal(acknowledgedHidden.phase, 'paused')
  assert.deepEqual(acknowledgedHidden.pauseReasons, ['hidden'])
  state = step(state, 'objective_acknowledged', 54000, { receipt })
  assert.equal(state.phase, 'running')
  assert.equal(state.activeMs, 35000)
  assert.equal(step(state, 'tick', 54100).activeMs, 35100)
  assert.deepEqual(state.completedObjectiveIds, [obj.objectiveId])
  state = step(state, 'objective_acknowledged', 54000, { receipt })
  assert.equal(state.completedObjectiveIds.length, 1)
})
test('objective overdue ends at the first representable time after deadline even on a delayed tick', () => {
  let state = running()
  state = step(state, 'objective_issued', 3000, { objective: objective(state) })
  for (let time = 4000; time <= 38000; time += 1000) state = activity(state, time)
  state = step(state, 'tick', 90000)
  assert.equal(state.terminal.primaryReason, 'objective_deadline')
  assert.ok(state.activeMs > 35000 && state.activeMs < 35000.001)
})
test('definite rejection continues immediately with the same objective and pre-request budgets', () => {
  let state = running()
  const obj = objective(state)
  state = step(state, 'objective_issued', 3000, { objective: obj })
  const payload = { ...submission(obj), submittedAtActiveMs: 1000 }
  state = step(state, 'objective_submitted', 4000, { submission: payload })
  state = step(state, 'objective_rejected', 100000, { runId, objectiveId: obj.objectiveId, requestId: payload.requestId, message: 'Invalid post.' })
  assert.equal(state.phase, 'running')
  assert.equal(state.activeMs, 1000)
  assert.equal(state.idleElapsedMs, 1000)
  assert.equal(state.objective.objectiveId, obj.objectiveId)
  assert.equal(state.pendingObjective, null)
  assert.deepEqual(state.pauseReasons, [])
  const advanced = step(state, 'tick', 100100)
  assert.equal(advanced.activeMs, 1100)
  assert.equal(advanced.idleElapsedMs, 1100)
  assert.equal(advanced.objective.deadlineActiveMs, obj.deadlineActiveMs)
})
test('definite rejection preserves overlapping pauses', () => {
  for (const reason of ['leaderboard', 'hidden', 'blurred', 'required_resource']) {
    let state = running()
    const obj = objective(state)
    const payload = { ...submission(obj), submittedAtActiveMs: 1000 }
    state = step(state, 'objective_issued', 3000, { objective: obj })
    state = step(state, 'objective_submitted', 4000, { submission: payload })
    state = step(state, 'pause_acquired', 5000, { reason })
    state = step(state, 'objective_rejected', 100000, { runId, objectiveId: obj.objectiveId, requestId: payload.requestId, message: 'Invalid post.' })
    assert.equal(state.phase, 'paused')
    assert.deepEqual(state.pauseReasons, [reason])
    assert.equal(step(state, 'tick', 100100).activeMs, 1000)
    assert.equal(state.pendingObjective, null)
    assert.equal(state.objective.objectiveId, obj.objectiveId)
  }
})
test('interruption is neutral, unranked local terminal and frozen', () => {
  const state = step(running(), 'interrupted', 4000, { runId, cause: 'reload' })
  assert.equal(state.phase, 'ended')
  assert.equal(state.terminal.status, 'interrupted')
  assert.equal(state.terminal.activeMs, 1000)
  assert.deepEqual(state.terminal.measurements, [])
})
test('touch/keyboard run does not count pointer detector windows', () => {
  let state = step(createSurvivalState(), 'start_acknowledged', 0, { receipt: { ...startReceipt, inputMode: 'touch_or_keyboard' } })
  state = step(state, 'countdown_finished', 3000)
  for (let i = 0; i < 3; i++) state = step(state, 'detector_evaluated', 3000, { result: bad('pointer', 'boot') })
  assert.equal(state.phase, 'running')
  assert.equal(state.badWindows.pointer, 0)
})

test('a window retains the stage at its start across a difficulty boundary', () => {
  let state = keptAlive(123000)
  state = step(state, 'detector_evaluated', 123000, { result: bad('typing', 'audit') })
  assert.equal(state.phase, 'running') // Audit requires two; Purge would require one.
  state = step(state, 'detector_evaluated', 123001, { result: bad('typing', 'audit') })
  assert.equal(state.terminal.stage, 'purge')
  assert.equal(state.terminal.measurements[0].stage, 'audit')
})
test('failed pointer evidence is cloned, bounded and immutable', () => {
  const state = keptAlive(123000)
  const pointerTrace = Array.from({ length: 6 }, (_, i) => ({ x: i / 5, y: .5, t: i * 50 }))
  const ended = step(state, 'detector_evaluated', 123000, { result: { ...bad('pointer'), pointerTrace } })
  pointerTrace[0].x = .9
  assert.equal(ended.terminal.pointerTrace[0].x, 0)
  assert.ok(Object.isFrozen(ended.terminal.pointerTrace[0]))
  assert.throws(() => step(state, 'detector_evaluated', 123000, { result: { ...bad('pointer'), pointerTrace: Array(25).fill(pointerTrace[0]) } }))
})
test('an objective expires before idle when a single delayed tick crosses both', () => {
  let state = running()
  state = step(state, 'objective_issued', 3000, { objective: objective(state) })
  for (let time = 4000; time <= 37000; time += 1000) state = activity(state, time)
  const ended = step(state, 'tick', 90000)
  assert.equal(ended.terminal.primaryReason, 'objective_deadline')
  assert.ok(ended.activeMs > 35000 && ended.activeMs < 35000.001)
})
test('verification wins over an equal-time objective expiration', () => {
  let state = running()
  state = step(state, 'objective_issued', 3000, { objective: objective(state) })
  for (let time = 4000; time <= 38000; time += 1000) state = activity(state, time)
  const timestamp = 38000 + (35000 * Number.EPSILON)
  const ended = step(state, 'verification_rejected', timestamp, { runId, attemptId: 7 })
  assert.equal(ended.terminal.primaryReason, 'verification_failed')
  assert.deepEqual(ended.terminal.measurements.map(m => m.reason), ['verification_failed', 'objective_deadline'])
})

test('slow typing windows latch typing failure with WPM evidence', () => {
  let state = running()
  for (let i = 0; i < 3; i++) {
    state = step(state, 'detector_evaluated', 3001 + i, { result: {
      detector: 'typing', stage: 'boot', outcome: 'bad', typingMetric: 'speed', value: 19,
      threshold: 20, explanation: 'Typing below minimum speed.',
    } })
  }
  assert.equal(state.phase, 'ended')
  assert.equal(state.terminal.primaryReason, 'typing')
  assert.equal(state.terminal.measurements[0].unit, 'wpm')
  assert.equal(state.terminal.measurements[0].value, 19)
})
