import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const disposable = mkdtempSync(join(tmpdir(), 'survival-api-'))
process.env.DB_PATH = join(disposable, 'isolated.sqlite')
const root = resolve('src')
register('data:text/javascript,' + encodeURIComponent(`
export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) return nextResolve(${JSON.stringify(pathToFileURL(root + '/').href)} + specifier.slice(2) + '.ts', context);
  if (context.parentURL?.startsWith(${JSON.stringify(pathToFileURL(root + '/lib/').href)}) && specifier.startsWith('.') && !['.mjs','.js','.ts'].some(ext => specifier.endsWith(ext))) return nextResolve(specifier + '.ts', context);
  return nextResolve(specifier, context);
}`), import.meta.url)

const startRoute = await import('../src/app/api/runs/route.ts')
const bindRoute = await import('../src/app/api/runs/[id]/bind/route.ts')
const finishRoute = await import('../src/app/api/runs/[id]/finish/route.ts')
const scoresRoute = await import('../src/app/api/scores/route.ts')
const { getDb } = await import('../src/lib/db.ts')
let serial = 0
const key = (prefix) => `${prefix}_${String(++serial).padStart(16, '0')}`
const post = (route, body, context) => route.POST(new Request('http://local/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), context)
const createRun = async (mode = 'pointer') => {
  const input = { requestId: key('start'), rulesVersion: 'survival-v3', inputMode: mode }
  const response = await post(startRoute, input)
  assert.equal(response.status, 200)
  return { runId: (await response.json()).runId, startInput: input }
}
const bind = async (runId, handle = 'player') => post(bindRoute, { requestId: key('bind'), handle }, { params: Promise.resolve({ id: runId }) })
const failedSnapshot = (runId, inputMode = 'pointer', activeMs = 12000, value = 12000) => ({
  runId, rulesVersion: 'survival-v3', inputMode, activeMs, stage: activeMs >= 30000 ? 'observe' : 'boot', completedObjectiveIds: [], status: 'failed', primaryReason: 'idle',
  measurements: [{ reason: 'idle', activeMs, stage: activeMs >= 30000 ? 'observe' : 'boot', value, threshold: activeMs >= 30000 ? 10000 : 12000, unit: 'ms', explanation: 'Idle limit reached.' }],
})
const finish = (runId, snapshot, requestId = key('finish')) => post(finishRoute, { requestId, snapshot }, { params: Promise.resolve({ id: runId }) })
const scores = (mode = 'pointer') => scoresRoute.GET(new Request(`http://local/api/scores?inputMode=${mode}`))

before(() => {
  getDb().prepare('insert into users (handle) values (?)').run('player')
  getDb().prepare('insert into users (handle) values (?)').run('other')
})
after(() => rmSync(disposable, { recursive: true, force: true }))

test('start, bind and finish replay same operations and reject conflicting IDs or identity', async () => {
  const startInput = { requestId: key('start'), rulesVersion: 'survival-v3', inputMode: 'pointer' }
  const first = await post(startRoute, startInput)
  const receipt = await first.json()
  assert.equal(first.status, 200)
  assert.deepEqual(await (await post(startRoute, startInput)).json(), receipt)
  assert.equal((await post(startRoute, { ...startInput, inputMode: 'touch_or_keyboard' })).status, 409)
  const bindInput = { requestId: key('bind'), handle: 'player' }
  const bindContext = { params: Promise.resolve({ id: receipt.runId }) }
  const bound = await post(bindRoute, bindInput, bindContext)
  const boundReceipt = await bound.json()
  assert.equal(bound.status, 200)
  assert.deepEqual(await (await post(bindRoute, bindInput, bindContext)).json(), boundReceipt)
  assert.equal((await bind(receipt.runId)).status, 200)
  const conflict = await bindRoute.POST(new Request('http://local/api', { method: 'POST', body: JSON.stringify({ requestId: key('bind'), handle: 'other' }) }), { params: Promise.resolve({ id: receipt.runId }) })
  assert.equal(conflict.status, 409)
  const snapshot = failedSnapshot(receipt.runId)
  const finishId = key('finish')
  const done = await finish(receipt.runId, snapshot, finishId)
  const saved = await done.json()
  assert.equal(done.status, 200, JSON.stringify(saved)); assert.equal(saved.ranked, true)
  assert.deepEqual(await (await finish(receipt.runId, snapshot, finishId)).json(), saved)
  const changed = structuredClone(snapshot); changed.measurements[0].explanation = 'Changed terminal payload.'
  assert.equal((await finish(receipt.runId, changed, key('finish'))).status, 409)
})

test('strict evidence validation rejects unknown fields and wrong thresholds without writing', async () => {
  const { runId } = await createRun()
  const invalid = failedSnapshot(runId)
  invalid.measurements[0].threshold = 1
  assert.equal((await finish(runId, invalid)).status, 400)
  const extra = { requestId: key('start'), rulesVersion: 'survival-v3', inputMode: 'pointer', extra: true }
  assert.equal((await post(startRoute, extra)).status, 400)
  assert.equal(getDb().prepare('select terminal_status from game_runs where id=?').get(runId).terminal_status, null)
  assert.throws(() => getDb().prepare(`insert into game_objective_events
    (completion_id,run_id,objective_id,request_id,user_id,action_kind,action_id,issued_active_ms,submitted_active_ms,deadline_active_ms,stage,receipt_json,recorded_at)
    values ('completion_00000001','missing_run_00000001','objective_00000001','request_0000000001',1,'post',1,0,1,10,'boot','{}','2026-09-26T00:00:00.000Z')`).run(), /FOREIGN KEY constraint failed/)
})

test('failed saves roll back and an identical retry records exactly once', async () => {
  const { runId } = await createRun()
  const snapshot = failedSnapshot(runId)
  const requestId = key('finish')
  getDb().exec("create trigger fail_run_save before update on game_runs when old.id = '" + runId + "' begin select raise(abort, 'injected save failure'); end")
  assert.equal((await finish(runId, snapshot, requestId)).status, 500)
  assert.equal(getDb().prepare('select terminal_status from game_runs where id=?').get(runId).terminal_status, null)
  getDb().exec('drop trigger fail_run_save')
  assert.equal((await finish(runId, snapshot, requestId)).status, 200)
  assert.equal((await finish(runId, snapshot, requestId)).status, 200)
  assert.equal(getDb().prepare('select count(*) as count from operation_receipts where request_id=?').get(requestId).count, 1)
})

test('scores select one whole best bound failed run and filter mode; anonymous and interrupted are excluded', async () => {
  const best = await createRun('pointer'); await bind(best.runId)
  await finish(best.runId, failedSnapshot(best.runId, 'pointer', 30000, 10000))
  const worse = await createRun('pointer'); await bind(worse.runId)
  await finish(worse.runId, failedSnapshot(worse.runId, 'pointer', 12000, 12000))
  const touch = await createRun('touch_or_keyboard'); await bind(touch.runId)
  await finish(touch.runId, failedSnapshot(touch.runId, 'touch_or_keyboard', 12000, 12000))
  const anonymous = await createRun('pointer')
  await finish(anonymous.runId, failedSnapshot(anonymous.runId))
  const interrupted = await createRun('pointer'); await bind(interrupted.runId)
  const interruptSnapshot = { runId: interrupted.runId, rulesVersion: 'survival-v3', inputMode: 'pointer', activeMs: 12000, stage: 'boot', completedObjectiveIds: [], status: 'interrupted', interruption: 'reload', measurements: [] }
  await finish(interrupted.runId, interruptSnapshot)
  const pointerResult = await (await scores('pointer')).json()
  assert.equal(pointerResult.scores.length, 1)
  assert.equal(pointerResult.scores[0].runId, best.runId)
  assert.equal(pointerResult.scores[0].activeMs, 30000)
  const touchResult = await (await scores('touch_or_keyboard')).json()
  assert.deepEqual(touchResult.scores.map((row) => row.runId), [touch.runId])
  assert.equal(scoresRoute.GET(new Request('http://local/api/scores')).status, 400)
  assert.equal(scoresRoute.POST().status, 410)
})
