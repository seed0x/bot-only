import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SURVIVAL_RULES_VERSION, survivalStageAt } from '../src/lib/survival/config.ts'

// Disposable database: never the shared data.db.
const dir = mkdtempSync(join(tmpdir(), 'survival-runs-'))
process.env.DB_PATH = join(dir, 'runs.db')
// Node's native TS runner needs extensions; resolve the app's extensionless relative imports under src/.
const src = new URL('../src/', import.meta.url).href
register('data:text/javascript,' + encodeURIComponent(`
  export function resolve(specifier, context, nextResolve) {
    const local = context.parentURL?.startsWith(${JSON.stringify(src)}) && /^\\.\\.?\\//.test(specifier) && !/\\.[a-z]+$/.test(specifier)
    return nextResolve(local ? specifier + '.ts' : specifier, context)
  }
`), import.meta.url)
const runs = await import('../src/lib/survival/runs.ts')
const { getDb } = await import('../src/lib/db.ts')
after(() => { getDb().close(); rmSync(dir, { recursive: true, force: true }) })

let seq = 0
const rid = (prefix = 'request') => `${prefix}_${String(++seq).padStart(16, '0')}`
const unit = handle => ({ id: Number(getDb().prepare('insert into users (handle, verified_bot) values (?, 1)').run(handle).lastInsertRowid), handle })
const start = (inputMode = 'pointer') => runs.startRun(runs.parseStart({ requestId: rid(), rulesVersion: SURVIVAL_RULES_VERSION, inputMode })).runId
const bind = (runId, user, requestId = rid()) => runs.bindRun(runId, runs.parseBind({ requestId, handle: user.handle }), user)
const idle = (runId, activeMs, extra = {}) => {
  const stage = survivalStageAt(activeMs)
  return { runId, rulesVersion: SURVIVAL_RULES_VERSION, inputMode: 'pointer', activeMs, stage: stage.id, completedObjectiveIds: [], status: 'failed', primaryReason: 'idle',
    measurements: [{ reason: 'idle', activeMs, stage: stage.id, value: stage.idleLimitMs, threshold: stage.idleLimitMs, unit: 'ms', explanation: 'No qualifying activity before the idle limit.' }], ...extra }
}
const interrupted = (runId, activeMs) => ({ runId, rulesVersion: SURVIVAL_RULES_VERSION, inputMode: 'pointer', activeMs, stage: survivalStageAt(activeMs).id,
  completedObjectiveIds: [], status: 'interrupted', interruption: 'reload', measurements: [] })
const finish = (snapshot, user, requestId = rid()) => runs.finishRun(runs.parseFinish(snapshot.runId, { requestId, snapshot }), user)
let actionId = 0
const complete = (runId, user, objectiveId) => getDb().prepare(`insert into game_objective_events (completion_id, run_id, objective_id, request_id, user_id,
  action_kind, action_id, target_post_id, issued_active_ms, submitted_active_ms, deadline_active_ms, stage, receipt_json, recorded_at)
  values (?, ?, ?, ?, ?, 'post', ?, null, 0, 1000, 35000, 'boot', '{}', ?)`).run(rid('done'), runId, objectiveId, rid(), user.id, ++actionId, new Date().toISOString())
const statusOf = fn => { try { fn() } catch (error) { if (error?.status) return error.status; throw error } return 200 }
const row = runId => getDb().prepare('select * from game_runs where id = ?').get(runId)

test('start validates the exact request and replays one run per request ID', () => {
  const request = { requestId: rid(), rulesVersion: SURVIVAL_RULES_VERSION, inputMode: 'touch_or_keyboard' }
  const receipt = runs.startRun(runs.parseStart(request))
  assert.equal(receipt.ok, true)
  assert.match(receipt.runId, /^[a-zA-Z0-9_-]{16,100}$/)
  assert.equal(new Date(receipt.startedAt).toISOString(), receipt.startedAt)
  assert.deepEqual(runs.startRun(runs.parseStart({ inputMode: 'touch_or_keyboard', rulesVersion: SURVIVAL_RULES_VERSION, requestId: request.requestId })), receipt)
  assert.equal(statusOf(() => runs.startRun(runs.parseStart({ ...request, inputMode: 'pointer' }))), 409)
  assert.equal(getDb().prepare('select count(*) as n from game_runs').get().n, 1)
  assert.equal(row(receipt.runId).terminal_status, null)
  for (const bad of [{ ...request, extra: 1 }, { requestId: request.requestId, rulesVersion: SURVIVAL_RULES_VERSION }, { ...request, rulesVersion: 'survival-v0' },
    { ...request, inputMode: 'mouse' }, { ...request, requestId: 'short' }, [request], null]) assert.equal(statusOf(() => runs.parseStart(bad)), 400)
})

test('bind takes the admitted identity once and rejects conflicts', () => {
  const one = unit('bind_one'), two = unit('bind_two'), runId = start()
  assert.equal(statusOf(() => runs.bindRun(runId, runs.parseBind({ requestId: rid(), handle: one.handle }), null)), 403)
  assert.equal(statusOf(() => runs.bindRun(runId, runs.parseBind({ requestId: rid(), handle: one.handle }), two)), 403)
  assert.equal(statusOf(() => bind('run_0000000000000missing', one)), 404)
  const requestId = rid(), receipt = bind(runId, one, requestId)
  assert.deepEqual(receipt, { ok: true, requestId, runId, user: one })
  assert.deepEqual(bind(runId, one, requestId), receipt)
  assert.deepEqual(bind(runId, one).user, one)
  assert.equal(statusOf(() => bind(runId, two)), 409)
  assert.equal(row(runId).user_id, one.id)
  assert.equal(statusOf(() => runs.parseBind({ requestId: rid(), handle: 'system' })), 400)
  const ended = start()
  assert.equal(finish(interrupted(ended, 5000), null).ranked, false)
  assert.equal(statusOf(() => bind(ended, one)), 409)
})

test('finish stores one terminal result, replays it and rejects a second writer', () => {
  const one = unit('finish_one'), other = unit('finish_other'), runId = start()
  bind(runId, one)
  const requestId = rid(), snapshot = idle(runId, 45000)
  const receipt = finish(snapshot, one, requestId)
  assert.deepEqual({ ...receipt, recordedAt: 'x' }, { ok: true, requestId, runId, resultId: runId, ranked: true, recordedAt: 'x' })
  assert.deepEqual(finish(snapshot, one, requestId), receipt)
  assert.equal(statusOf(() => finish(idle(runId, 46000), one, requestId)), 409)
  assert.equal(statusOf(() => finish(snapshot, one)), 409)
  const stored = row(runId)
  assert.deepEqual([stored.terminal_status, stored.active_ms, stored.completed_objectives, stored.primary_reason], ['failed', 45000, 0, 'idle'])
  assert.deepEqual(JSON.parse(stored.snapshot_json), snapshot)
  assert.throws(() => getDb().prepare('update game_runs set active_ms = 1 where id = ?').run(runId), /write-once/)
  assert.throws(() => getDb().prepare('update game_runs set user_id = ? where id = ?').run(other.id, runId), /write-once/)
  const guarded = start()
  bind(guarded, one)
  assert.equal(statusOf(() => finish(idle(guarded, 5000), other)), 403)
  assert.equal(statusOf(() => finish(idle(guarded, 5000), null)), 403)
  assert.equal(statusOf(() => finish(idle('run_0000000000000missing', 5000), one)), 404)
  assert.equal(statusOf(() => finish({ ...idle(guarded, 5000), inputMode: 'touch_or_keyboard' }, one)), 409)
  assert.equal(finish(interrupted(guarded, 5000), one).ranked, false)
  const anonymous = start()
  assert.equal(finish(idle(anonymous, 5000), null).ranked, false)
})

test('finish requires exactly the persisted objective completions', () => {
  const one = unit('objective_one'), runId = start()
  bind(runId, one)
  complete(runId, one, 'objective_0000000001')
  assert.equal(statusOf(() => finish(idle(runId, 70000), one)), 409)
  assert.equal(statusOf(() => finish(idle(runId, 70000, { completedObjectiveIds: ['objective_0000000002'] }), one)), 409)
  assert.equal(finish(idle(runId, 70000, { completedObjectiveIds: ['objective_0000000001'] }), one).ranked, true)
  assert.equal(row(runId).completed_objectives, 1)
})

test('finish validation rejects malformed snapshots and evidence with 400', () => {
  const runId = 'run_00000000000000valid'
  const base = idle(runId, 45000)
  const m = base.measurements[0]
  const pointer = { reason: 'pointer', activeMs: 45000, stage: 'boot', value: .3, threshold: .18, unit: 'ratio', explanation: 'Stroke deviated from a straight line.' }
  const trace = Array.from({ length: 6 }, (_, i) => ({ x: i / 10, y: .5, t: i * 30 }))
  const ok = snapshot => runs.parseFinish(runId, { requestId: rid(), snapshot })
  // Valid controls: detector window from an earlier stage, a trace, admission and rounded deadline budgets, interruption.
  ok({ ...base, primaryReason: 'pointer', measurements: [pointer], pointerTrace: trace })
  ok({ ...base, primaryReason: 'idle', measurements: [m, pointer] })
  ok({ ...base, activeMs: 60000.5, stage: 'inspect', primaryReason: 'objective_deadline', measurements: [{ reason: 'objective_deadline', activeMs: 60000.5, stage: 'boot', value: 60000.5, threshold: 60000, unit: 'ms', explanation: 'Deadline passed.' }] })
  ok({ ...base, primaryReason: 'objective_deadline', measurements: [{ reason: 'objective_deadline', activeMs: 45000, stage: 'boot', value: 35000.1, threshold: (0.1 + 35000) - 0.1, unit: 'ms', explanation: 'Deadline passed.' }] })
  ok({ ...base, primaryReason: 'verification_failed', measurements: [{ reason: 'verification_failed', activeMs: 45000, stage: 'observe', value: 1, threshold: 0, unit: 'boolean', explanation: 'Rejected.' }, m] })
  ok(interrupted(runId, 0))
  const invalid = [
    { ...base, runId: 'run_00000000000000other' }, { ...base, stage: 'boot' }, { ...base, activeMs: 86400001, stage: 'purge' }, { ...base, activeMs: -1 },
    { ...base, extra: true }, { ...base, rulesVersion: 'survival-v2' }, { ...base, inputMode: 'mouse' }, { ...base, status: 'running' },
    { ...base, primaryReason: 'pointer' }, { ...base, measurements: [pointer, m] }, { ...base, measurements: [m, m] }, { ...base, measurements: [] },
    { ...base, measurements: Array(7).fill(m) }, { ...base, measurements: [{ ...m, unit: 'cv' }] }, { ...base, measurements: [{ ...m, threshold: 12000 }] },
    { ...base, measurements: [{ ...m, activeMs: 44999 }] }, { ...base, measurements: [{ ...m, stage: 'boot', threshold: 12000 }] },
    { ...base, primaryReason: 'pointer', measurements: [{ ...pointer, stage: 'purge', threshold: .05 }] }, { ...base, measurements: [{ ...m, explanation: '' }] },
    { ...base, measurements: [{ ...m, explanation: 'x'.repeat(241) }] }, { ...base, measurements: [{ ...m, value: -1 }] }, { ...base, measurements: [{ ...m, note: 1 }] },
    { ...base, primaryReason: 'verification_failed', measurements: [{ reason: 'verification_failed', activeMs: 45000, stage: 'observe', value: 0, threshold: 0, unit: 'boolean', explanation: 'x' }] },
    { ...base, primaryReason: 'pointer', measurements: [{ ...pointer, value: 1000001 }] }, { ...base, pointerTrace: trace },
    { ...base, primaryReason: 'pointer', measurements: [pointer], pointerTrace: trace.slice(1) }, { ...base, primaryReason: 'pointer', measurements: [pointer], pointerTrace: trace.slice(0, 5) },
    { ...base, primaryReason: 'pointer', measurements: [pointer], pointerTrace: [...trace.slice(0, 5), { x: 1.2, y: .5, t: 200 }] },
    { ...base, primaryReason: 'pointer', measurements: [pointer], pointerTrace: [...trace.slice(0, 5), { x: .5, y: .5, t: 751 }] },
    { ...base, primaryReason: 'objective_deadline', measurements: [{ reason: 'objective_deadline', activeMs: 45000, stage: 'boot', value: 40000, threshold: 34000, unit: 'ms', explanation: 'x' }] },
    { ...base, completedObjectiveIds: ['objective_0000000001', 'objective_0000000001'] }, { ...base, completedObjectiveIds: ['bad id'] },
    { ...interrupted(runId, 0), measurements: [m] }, { ...interrupted(runId, 0), primaryReason: 'idle' }, { ...interrupted(runId, 0), interruption: 'crash' },
    { ...base, interruption: 'reload' },
  ]
  invalid.forEach((snapshot, i) => assert.equal(statusOf(() => ok(snapshot)), 400, `invalid snapshot ${i}`))
  assert.equal(statusOf(() => runs.parseFinish(runId, { requestId: rid(), snapshot: base, extra: 1 })), 400)
})

test('bodies over the byte limit are 413 and malformed JSON is 400', async () => {
  const body = text => new Request('http://local/api', { method: 'POST', body: text })
  await assert.rejects(runs.readBody(body(JSON.stringify({ pad: 'x'.repeat(16384) })), 16384), error => error.status === 413)
  await assert.rejects(runs.readBody(body('é'.repeat(8200)), 16384), error => error.status === 413)
  for (const text of ['{', '[]', 'null', '"x"']) await assert.rejects(runs.readBody(body(text), 16384), error => error.status === 400)
  await assert.rejects(runs.readBody(new Request('http://local/api', { method: 'POST', body: new Uint8Array([0x7b, 0xff, 0x7d]) }), 16384), error => error.status === 400)
  assert.deepEqual(await runs.readBody(body('{"a":1}'), 16384), { a: 1 })
})

test('ranking keeps one whole best confirmed run per unit in each mode', () => {
  getDb().exec('delete from game_objective_events; delete from game_runs')
  const alpha = unit('alpha'), bravo = unit('bravo'), delta = unit('delta'), touch = unit('touch_unit')
  const ranked = (inputMode = 'pointer') => runs.survivalScores(runs.parseScoreQuery(new URLSearchParams({ inputMode }))).scores
  const run = (user, activeMs, objectives = [], inputMode = 'pointer') => {
    const runId = start(inputMode)
    if (user) bind(runId, user)
    objectives.forEach(id => complete(runId, user, id))
    finish(idle(runId, activeMs, { inputMode, completedObjectiveIds: objectives }), user)
    return runId
  }
  assert.deepEqual(ranked(), [])
  const alphaBest = run(alpha, 50000)
  run(alpha, 40000)
  finish(interrupted(bind(start(), alpha).runId, 90000), alpha)
  bind(start(), alpha)
  run(null, 100000)
  run(bravo, 50000, ['objective_0000000011'])
  const deltaRuns = [run(delta, 50000), run(delta, 50000)].sort()
  run(touch, 70000, [], 'touch_or_keyboard')
  assert.deepEqual(ranked(), [
    { runId: getDb().prepare("select id from game_runs where user_id = ? and terminal_status = 'failed'").get(bravo.id).id, handle: 'bravo', activeMs: 50000, completedObjectives: 1, roundsSurvived: 1, stage: 'observe' },
    { runId: alphaBest, handle: 'alpha', activeMs: 50000, completedObjectives: 0, roundsSurvived: 1, stage: 'observe' },
    { runId: deltaRuns[0], handle: 'delta', activeMs: 50000, completedObjectives: 0, roundsSurvived: 1, stage: 'observe' },
  ])
  assert.deepEqual(ranked('touch_or_keyboard').map(r => [r.handle, r.activeMs, r.stage]), [['touch_unit', 70000, 'inspect']])
  // A better later run replaces the best; its objective count comes from that same run, not a combined maximum.
  run(bravo, 30000, ['objective_0000000012', 'objective_0000000013'])
  const newBest = run(alpha, 125000.5)
  const top = ranked()[0]
  assert.deepEqual(top, { runId: newBest, handle: 'alpha', activeMs: 125000.5, completedObjectives: 0, roundsSurvived: 4, stage: 'purge' })
  assert.deepEqual(ranked().map(r => [r.handle, r.completedObjectives]), [['alpha', 0], ['bravo', 1], ['delta', 0]])
})

test('score query requires one input mode and rejects unknown filters', () => {
  const parse = query => runs.parseScoreQuery(new URLSearchParams(query))
  assert.deepEqual(parse('inputMode=pointer'), { inputMode: 'pointer', rulesVersion: SURVIVAL_RULES_VERSION })
  assert.deepEqual(parse(`inputMode=touch_or_keyboard&rulesVersion=${SURVIVAL_RULES_VERSION}`), { inputMode: 'touch_or_keyboard', rulesVersion: SURVIVAL_RULES_VERSION })
  for (const query of ['', 'rulesVersion=survival-v1', 'inputMode=mouse', 'inputMode=pointer&limit=5', 'inputMode=pointer&inputMode=pointer', 'inputMode=pointer&rulesVersion=survival-v0'])
    assert.equal(statusOf(() => parse(query)), 400, query)
})
