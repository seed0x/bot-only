// Survival run persistence and leaderboard over HTTP. Mutates only an explicitly selected isolated test server.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { solveImage } from './captcha-solver.mjs'
if (!process.env.BASE_URL) throw new Error('Set BASE_URL to an isolated test server.')
const base = process.env.BASE_URL
const handle = 'lb_' + randomUUID().slice(0, 8)
const id = () => 'req_' + randomUUID().replaceAll('-', '')
let cookie = '', checks = 0
const pass = name => { checks++; console.log('PASS', name) }
async function call(path, body, { raw, withCookie = true } = {}) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(10000),
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(withCookie && cookie ? { cookie } : {}) },
    ...(body === undefined ? {} : { body: raw ? body : JSON.stringify(body) }),
  })
  const setCookie = response.headers.get('set-cookie')
  if (setCookie && withCookie) cookie = setCookie.split(';')[0]
  return { status: response.status, body: await response.json() }
}
const ok = async (path, body, options) => {
  const result = await call(path, body, options)
  assert.equal(result.status, 200, JSON.stringify(result.body))
  return result.body
}
const idle = (runId, activeMs, inputMode = 'pointer') => {
  const stage = activeMs < 30000 ? ['boot', 12000] : activeMs < 60000 ? ['observe', 10000] : activeMs < 90000 ? ['inspect', 8000] : activeMs < 120000 ? ['audit', 6000] : ['purge', 4000]
  return { runId, rulesVersion: 'survival-v1', inputMode, activeMs, stage: stage[0], completedObjectiveIds: [], status: 'failed', primaryReason: 'idle',
    measurements: [{ reason: 'idle', activeMs, stage: stage[0], value: stage[1], threshold: stage[1], unit: 'ms', explanation: 'No qualifying activity before the idle limit.' }] }
}
const start = (inputMode = 'pointer', requestId = id()) => ok('/api/runs', { requestId, rulesVersion: 'survival-v1', inputMode })
const bind = (runId, requestId = id()) => ok(`/api/runs/${runId}/bind`, { requestId, handle })
const finish = (snapshot, requestId = id()) => call(`/api/runs/${snapshot.runId}/finish`, { requestId, snapshot })
const board = async (inputMode = 'pointer') => (await ok('/api/scores?inputMode=' + inputMode)).scores.filter(row => row.handle === handle)

// Admission through the real gate: designation, then a server-scored image CAPTCHA pass sets the HttpOnly cookie.
await ok('/api/register', { requestId: randomUUID(), handle })
const challenge = await ok('/api/play', { requestId: randomUUID(), handle, kind: 'image-confusion' })
const { clicks } = await solveImage(challenge, async src => (await fetch(base + src, { signal: AbortSignal.timeout(10000) })).arrayBuffer())
await delay(clicks.at(-1).t + 50)
assert.equal((await ok('/api/register', { requestId: randomUUID(), handle, challengeId: challenge.id, solution: { clicks } })).passed, true)
assert.match(cookie, /^bot-only-admission=[a-f0-9]{64}$/)
pass('unit admitted through the image gate')

const startId = id(), started = await start('pointer', startId)
assert.match(started.runId, /^[a-zA-Z0-9_-]{16,100}$/)
assert.deepEqual(await start('pointer', startId), started)
assert.equal((await call('/api/runs', { requestId: startId, rulesVersion: 'survival-v1', inputMode: 'touch_or_keyboard' })).status, 409)
pass('start replays one run per request ID; changed payload is 409')
for (const body of [{ requestId: id(), rulesVersion: 'survival-v0', inputMode: 'pointer' }, { requestId: id(), rulesVersion: 'survival-v1', inputMode: 'pointer', extra: 1 }])
  assert.equal((await call('/api/runs', body)).status, 400)
assert.equal((await call('/api/runs', '{"requestId":', { raw: true })).status, 400)
assert.equal((await call('/api/runs', JSON.stringify({ pad: 'x'.repeat(64001) }), { raw: true })).status, 413)
pass('start rejects unknown version, unknown field, malformed JSON (400) and oversized body (413)')

const runId = started.runId
assert.equal((await call(`/api/runs/${runId}/bind`, { requestId: id(), handle }, { withCookie: false })).status, 403)
const bindId = id(), bound = await bind(runId, bindId)
assert.deepEqual([bound.ok, bound.runId, bound.user.handle], [true, runId, handle])
assert.deepEqual(await bind(runId, bindId), bound)
assert.equal((await bind(runId)).user.id, bound.user.id)
assert.equal((await call('/api/runs/run_00000000000000missing/bind', { requestId: id(), handle })).status, 404)
pass('bind needs the admission cookie (403), replays, rebinding the same unit is idempotent, missing run is 404')

const finishId = id(), best = idle(runId, 50000)
const saved = await finish(best, finishId)
assert.equal(saved.status, 200)
assert.deepEqual([saved.body.ranked, saved.body.resultId, saved.body.runId], [true, runId, runId])
assert.deepEqual((await finish(best, finishId)).body, saved.body)
assert.equal((await finish(idle(runId, 51000), finishId)).status, 409)
assert.equal((await finish(best)).status, 409)
assert.equal((await call(`/api/runs/${runId}/finish`, JSON.stringify({ requestId: id(), snapshot: { ...best, pad: 'x'.repeat(16384) } }), { raw: true })).status, 413)
assert.equal((await call(`/api/runs/${runId}/finish`, { requestId: id(), snapshot: { ...best, stage: 'boot' } })).status, 400)
pass('finish saves one ranked result, replays it, and rejects changed payload/second writer (409), oversize (413), bad stage (400)')

const worse = await start()
await bind(worse.runId)
assert.equal((await finish(idle(worse.runId, 20000))).body.ranked, true)
const interrupted = await start()
await bind(interrupted.runId)
const cut = { ...idle(interrupted.runId, 90000), status: 'interrupted', interruption: 'reload', measurements: [] }
delete cut.primaryReason
assert.equal((await finish(cut)).body.ranked, false)
const anonymous = await ok('/api/runs', { requestId: id(), rulesVersion: 'survival-v1', inputMode: 'pointer' }, { withCookie: false })
assert.equal((await call(`/api/runs/${anonymous.runId}/finish`, { requestId: id(), snapshot: idle(anonymous.runId, 100000) }, { withCookie: false })).body.ranked, false)
const rows = await board()
assert.deepEqual(rows.map(row => [row.runId, row.activeMs, row.completedObjectives, row.roundsSurvived, row.stage]), [[runId, 50000, 0, 1, 'observe']])
pass('worse later run, interrupted run and anonymous run do not replace or join the best row')

const touch = await start('touch_or_keyboard')
await bind(touch.runId)
assert.equal((await finish(idle(touch.runId, 35000, 'touch_or_keyboard'))).body.ranked, true)
assert.deepEqual((await board('touch_or_keyboard')).map(row => row.activeMs), [35000])
assert.deepEqual((await board()).map(row => row.activeMs), [50000])
const response = await ok('/api/scores?inputMode=pointer&rulesVersion=survival-v1')
assert.deepEqual([response.rulesVersion, response.inputMode, Array.isArray(response.scores)], ['survival-v1', 'pointer', true])
for (const query of ['?rulesVersion=survival-v1', '?inputMode=mouse', '?inputMode=pointer&limit=5', '?inputMode=pointer&rulesVersion=survival-v0'])
  assert.equal((await call('/api/scores' + query)).status, 400)
assert.equal((await call("/api/scores")).status, 400)
pass('input modes rank separately; score query rejects missing mode and unknown filters; legacy bare GET still answers')
console.log(`${checks} leaderboard checks passed`)
