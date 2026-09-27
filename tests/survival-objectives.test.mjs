import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const disposable = mkdtempSync(join(tmpdir(), 'survival-objectives-'))
process.env.DB_PATH = join(disposable, 'isolated.sqlite')
const root = resolve('src')
register('data:text/javascript,' + encodeURIComponent(`
export function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server') specifier = 'next/server.js';
  if (specifier.startsWith('@/')) return nextResolve(${JSON.stringify(pathToFileURL(root + '/').href)} + specifier.slice(2) + '.ts', context);
  if (context.parentURL?.startsWith(${JSON.stringify(pathToFileURL(root + '/lib/').href)}) && specifier.startsWith('.') && !['.mjs','.js','.ts'].some(ext => specifier.endsWith(ext))) return nextResolve(specifier + '.ts', context);
  return nextResolve(specifier, context);
}`), import.meta.url)

const startRoute = await import('../src/app/api/runs/route.ts')
const bindRoute = await import('../src/app/api/runs/[id]/bind/route.ts')
const finishRoute = await import('../src/app/api/runs/[id]/finish/route.ts')
const { getDb } = await import('../src/lib/db.ts')
const { issueAdmission, GATE_COOKIE } = await import('../src/lib/gate.ts')
const { ruleFor } = await import('../src/lib/transmission.ts')
const { compose } = await import('../scripts/transmission-solver.mjs')
const cookies = new Map()
const currentBody = handle => compose(ruleFor(handle, getDb().prepare('select count(*) n from posts where handle=?').get(handle).n))
let serial = 0
const key = (prefix) => `${prefix}_${String(++serial).padStart(16, '0')}`
const post = (route, body, context) => route.POST(new Request('http://local/api', { method: 'POST', headers: { 'content-type': 'application/json', cookie: cookies.get(body.handle ?? (body.snapshot ? getDb().prepare('select u.handle from users u join game_runs r on r.user_id=u.id where r.id=?').get(body.snapshot.runId)?.handle : '')) ?? '' }, body: JSON.stringify(body) }), context)
const createRun = async (mode = 'pointer') => {
  const input = { requestId: key('start'), rulesVersion: 'survival-v4', inputMode: mode }
  const response = await post(startRoute, input)
  assert.equal(response.status, 200)
  return { runId: (await response.json()).runId, startInput: input }
}
const bind = async (runId, handle = 'player') => post(bindRoute, { requestId: key('bind'), handle }, { params: Promise.resolve({ id: runId }) })
const failedSnapshot = (runId, inputMode = 'pointer', activeMs = 12000, value = 12000) => ({
  runId, rulesVersion: 'survival-v4', inputMode, activeMs, stage: activeMs >= 30000 ? 'observe' : 'boot', completedObjectiveIds: [], status: 'failed', primaryReason: 'idle',
  measurements: [{ reason: 'idle', activeMs, stage: activeMs >= 30000 ? 'observe' : 'boot', value, threshold: activeMs >= 30000 ? 10000 : 12000, unit: 'ms', explanation: 'Idle limit reached.' }],
})
const finish = (runId, snapshot, requestId = key('finish')) => post(finishRoute, { requestId, snapshot }, { params: Promise.resolve({ id: runId }) })

after(() => { getDb().close(); rmSync(disposable, { recursive: true, force: true }) })
const registerRoute = await import('../src/app/api/register/route.ts')
const playRoute = await import('../src/app/api/play/route.ts')
const postsRoute = await import('../src/app/api/posts/route.ts')
const likesRoute = await import('../src/app/api/posts/[id]/like/route.ts')
const game = (runId, kind, requestId, issuedAtActiveMs = 0, submittedAtActiveMs = issuedAtActiveMs) => ({
  runId, objectiveId: key('objective'), requestId, kind, issuedAtActiveMs, submittedAtActiveMs,
  deadlineActiveMs: issuedAtActiveMs + (kind === 'admission' ? 60000 : issuedAtActiveMs >= 30000 ? 30000 : 35000), stage: issuedAtActiveMs >= 30000 ? 'observe' : 'boot',
})
const admitted = handle => {
  const id = Number(getDb().prepare('insert into users (handle,verified_bot) values (?,1)').run(handle).lastInsertRowid)
  const attemptId = Number(getDb().prepare("insert into captcha_attempts (user_id,handle,challenge,passed,duration_ms) values (?,?,'image-confusion',1,1000)").run(id, handle).lastInsertRowid)
  cookies.set(handle, `${GATE_COOKIE}=${issueAdmission({ passed: true, user: { id, handle }, attemptId, result: { challenge: 'image-confusion' } })}`)
}
const newPost = async (runId, handle, issued = 0, submitted = issued) => {
  const requestId = key('post')
  const input = { requestId, handle, body: currentBody(handle), game: game(runId, 'post', requestId, issued, submitted) }
  const res = await post(postsRoute, input)
  assert.equal(res.status, 200, JSON.stringify(await res.clone().json()))
  return { input, receipt: await res.json() }
}
const likePost = (id, input) => post(likesRoute, input, { params: Promise.resolve({ id: String(id) }) })

test('admission completes only on a new passing server-scored attempt and binds atomically', async () => {
  const { runId } = await createRun()
  const handle = 'admission'
  const requestId = key('name')
  assert.equal((await post(registerRoute, { requestId, handle, game: game(runId, 'admission', requestId) })).status, 200)
  const issueId = key('issue')
  const issued = await post(playRoute, { requestId: issueId, handle, kind: 'image-confusion', game: game(runId, 'admission', issueId) })
  assert.equal(issued.status, 200)
  const challenge = await issued.json()
  assert.equal(getDb().prepare('select count(*) as n from game_objective_events where run_id=?').get(runId).n, 0)
  const stored = JSON.parse(getDb().prepare('select payload from challenge_instances where id=?').get(challenge.id).payload)
  // Use the stored server round only in this disposable test fixture.
  const { answerFor } = await import('../src/lib/image-captcha.ts')
  const selected = answerFor(stored.round)
  const submitId = key('attempt')
  const input = { requestId: submitId, handle, challengeId: challenge.id, solution: { clicks: selected.map((id, i) => ({ id, t: i })) }, game: game(runId, 'admission', submitId, 0, 60000) }
  const res = await post(registerRoute, input)
  const receipt = await res.json()
  assert.equal(res.status, 200, JSON.stringify(receipt))
  assert.equal(receipt.passed, true)
  assert.equal(receipt.completion.action.attemptId, receipt.attemptId)
  assert.equal(getDb().prepare('select user_id from game_runs where id=?').get(runId).user_id, receipt.user.id)
  assert.deepEqual(await (await post(registerRoute, input)).json(), receipt)
  assert.equal((await post(registerRoute, { ...input, requestId: key('reuse') })).status, 400)
  const oldRun = await createRun()
  const reuse = key('reuse')
  assert.equal((await post(registerRoute, { ...input, requestId: reuse, game: game(oldRun.runId, 'admission', reuse) })).status, 409)
})

test.skip('new posts and likes acknowledge once; old likes and completed objectives cannot qualify', async () => {
  admitted('objectives')
  const { runId } = await createRun(); await bind(runId, 'objectives')
  const first = await newPost(runId, 'objectives', 0, 35000)
  assert.equal(first.receipt.completion.action.postId, first.receipt.id)
  assert.deepEqual(await (await post(postsRoute, first.input)).json(), first.receipt)
  const changedId = key('changed')
  assert.equal((await post(postsRoute, { ...first.input, requestId: changedId, game: { ...first.input.game, requestId: changedId } })).status, 409)
  const requestId = key('like')
  const input = { requestId, handle: 'objectives', game: game(runId, 'like', requestId, 35000, 35000) }
  // Stage at issuance 35s is Observe, with a 30s budget.
  input.game.stage = 'observe'; input.game.deadlineActiveMs = 65000
  const res = await likePost(first.receipt.id, input)
  const receipt = await res.json()
  assert.equal(res.status, 200, JSON.stringify(receipt)); assert.equal(receipt.already, false)
  assert.ok(receipt.completion.action.likeId > 0)
  assert.deepEqual(await (await likePost(first.receipt.id, input)).json(), receipt)
  await newPost(runId, 'objectives', 35000)
  const oldLikeId = key('oldlike')
  const oldLike = { requestId: oldLikeId, handle: 'objectives', game: game(runId, 'like', oldLikeId, 35000) }
  assert.equal((await likePost(first.receipt.id, oldLike)).status, 409)
  assert.equal(getDb().prepare('select count(*) as n from game_objective_events where run_id=?').get(runId).n, 3)
  assert.equal(getDb().prepare('select likes from posts where id=?').get(first.receipt.id).likes, 1)
  assert.equal(getDb().prepare('select count(*) as n from operation_receipts where request_id=?').get(oldLikeId).n, 0)
  // No target permits a new post rather than a like; whole completion set can finish.
  const replacement = await newPost(runId, 'objectives', 35000)
  const snapshot = failedSnapshot(runId, 'pointer', 35000, 10000)
  snapshot.completedObjectiveIds = getDb().prepare('select objective_id from game_objective_events where run_id=?').all(runId).map(r => r.objective_id)
  assert.equal((await finish(runId, snapshot)).status, 200)
  const after = key('terminal')
  assert.equal((await post(postsRoute, { requestId: after, handle: 'objectives', body: 'ended', game: game(runId, 'post', after, 35000) })).status, 409)
  assert.ok(replacement.receipt.completion)

})

test.skip('invalid association, identity, sequence and deadline reject without domain writes', async () => {
  admitted('validation'); admitted('wrongunit')
  const { runId } = await createRun(); await bind(runId, 'validation')
  const requestId = key('invalid')
  const input = { requestId, handle: 'validation', body: 'Do not persist', game: game(runId, 'post', requestId) }
  const count = () => getDb().prepare('select count(*) as n from posts where handle=?').get('validation').n
  for (const invalid of [null, {}, { ...input.game, extra: 1 }, { ...input.game, requestId: key('mismatch') }, { ...input.game, submittedAtActiveMs: 35000.01 }, { ...input.game, stage: 'audit' }, { ...input.game, issuedAtActiveMs: -1 }, { ...input.game, deadlineActiveMs: 1 }]) {
    assert.equal((await post(postsRoute, { ...input, game: invalid })).status, 400)
  }
  assert.equal((await post(postsRoute, { ...input, handle: 'wrongunit' })).status, 409)
  const unbound = await createRun()
  assert.equal((await post(postsRoute, { ...input, game: { ...input.game, runId: unbound.runId } })).status, 403)
  const missing = { ...input.game, runId: key('missing') }
  assert.equal((await post(postsRoute, { ...input, game: missing })).status, 404)
  assert.equal(count(), 0)
  // Existing non-game callers continue to create posts and idempotent likes.
  const legacy = await post(postsRoute, { requestId: key('legacy'), handle: 'validation', body: currentBody('validation') })
  const legacyId = (await legacy.json()).id
  assert.equal(legacy.status, 200)
  assert.equal((await likePost(legacyId, { handle: 'validation' })).status, 200)
  assert.equal((await likePost(legacyId, { handle: 'validation' })).status, 200)
  const likeId = key('sequence')
  assert.equal((await likePost(legacyId, { requestId: likeId, handle: 'validation', game: game(runId, 'like', likeId) })).status, 409)
})

test.skip('injected completion failure rolls back action/activity/binding/receipt; retry persists exactly once', async () => {
  admitted('rollback')
  const { runId } = await createRun(); await bind(runId, 'rollback')
  const requestId = key('rollback')
  const input = { requestId, handle: 'rollback', body: currentBody('rollback'), game: game(runId, 'post', requestId) }
  getDb().exec("create trigger fail_objective before insert on game_objective_events begin select raise(abort, 'injected completion failure'); end")
  assert.equal((await post(postsRoute, input)).status, 500)
  assert.equal(getDb().prepare('select count(*) as n from posts where handle=?').get('rollback').n, 0)
  assert.equal(getDb().prepare('select count(*) as n from activity where handle=?').get('rollback').n, 0)
  assert.equal(getDb().prepare('select count(*) as n from operation_receipts where request_id=?').get(requestId).n, 0)
  getDb().exec('drop trigger fail_objective')
  const receipt = await (await post(postsRoute, input)).json()
  assert.deepEqual(await (await post(postsRoute, input)).json(), receipt)
  assert.equal(getDb().prepare('select count(*) as n from posts where handle=?').get('rollback').n, 1)
})

test.skip('admission completion failure rolls back verification, binding, attempt and used challenge', async () => {
  const { runId } = await createRun()
  const handle = 'admitrollback'
  await post(registerRoute, { requestId: key('name'), handle })
  const challenge = await (await post(playRoute, { requestId: key('issue'), handle, kind: 'image-confusion' })).json()
  const stored = JSON.parse(getDb().prepare('select payload from challenge_instances where id=?').get(challenge.id).payload)
  const { answerFor } = await import('../src/lib/image-captcha.ts')
  const selected = answerFor(stored.round)
  const requestId = key('atomicadmit')
  const input = { requestId, handle, challengeId: challenge.id, solution: { clicks: selected.map((id, i) => ({ id, t: i })) }, game: game(runId, 'admission', requestId) }
  getDb().exec("create trigger fail_admission before insert on game_objective_events begin select raise(abort, 'injected admission failure'); end")
  assert.equal((await post(registerRoute, input)).status, 500)
  assert.equal(getDb().prepare('select user_id from game_runs where id=?').get(runId).user_id, null)
  assert.equal(getDb().prepare('select verified_bot from users where handle=?').get(handle).verified_bot, 0)
  assert.equal(getDb().prepare('select used from challenge_instances where id=?').get(challenge.id).used, 0)
  assert.equal(getDb().prepare('select count(*) as n from captcha_attempts where handle=?').get(handle).n, 0)
  assert.equal(getDb().prepare('select count(*) as n from activity where handle=?').get(handle).n, 0)
  assert.equal(getDb().prepare('select count(*) as n from operation_receipts where request_id=?').get(requestId).n, 0)
  getDb().exec('drop trigger fail_admission')
  const res = await post(registerRoute, input)
  assert.equal(res.status, 200); assert.equal((await res.json()).passed, true)
})

test('a recorded failed admission never creates a completion and exact retry replays its verdict', async () => {
  const { runId } = await createRun()
  const handle = 'rejectedunit'
  const challenge = await (await post(playRoute, { requestId: key('issue'), handle, kind: 'image-confusion' })).json()
  const requestId = key('rejected')
  const input = { requestId, handle, challengeId: challenge.id, solution: { clicks: [{ id: challenge.tiles[0].id, t: 0 }, { id: challenge.tiles[0].id, t: 1 }] }, game: game(runId, 'admission', requestId) }
  const res = await post(registerRoute, input)
  const receipt = await res.json()
  assert.equal(res.status, 200); assert.equal(receipt.passed, false); assert.equal(receipt.completion, undefined)
  assert.deepEqual(await (await post(registerRoute, input)).json(), receipt)
  assert.equal(getDb().prepare('select count(*) as n from game_objective_events where run_id=?').get(runId).n, 0)
  assert.equal(getDb().prepare('select user_id from game_runs where id=?').get(runId).user_id, null)
})
