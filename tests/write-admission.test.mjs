import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { compose } from '../scripts/transmission-solver.mjs'

// Real SQLite, isolated from the demo file. Exercise the actual route handlers.
const dir = mkdtempSync(join(tmpdir(), 'onlybots-admission-'))
process.env.DB_PATH = join(dir, 'data.db')
const src = new URL('../src/', import.meta.url).href
register('data:text/javascript,' + encodeURIComponent(`
 export function resolve(specifier, context, nextResolve) {
   if (specifier === 'next/server') specifier = 'next/server.js';
   if (specifier.startsWith('@/')) return { url: ${JSON.stringify(src)} + specifier.slice(2) + '.ts', shortCircuit: true };
   const local = context.parentURL?.startsWith(${JSON.stringify(src)}) && /^\\.\\.?\\//.test(specifier) && !/\\.[a-z]+$/.test(specifier);
   return nextResolve(local ? specifier + '.ts' : specifier, context);
 }
`), import.meta.url)
const { getDb } = await import('../src/lib/db.ts')
const { issueAdmission, requestAdmission, GATE_COOKIE } = await import('../src/lib/gate.ts')
const { ruleFor, replyRuleFor } = await import('../src/lib/transmission.ts')
const posts = await import('../src/app/api/posts/route.ts')
const replies = await import('../src/app/api/posts/[id]/comments/route.ts')
const likes = await import('../src/app/api/posts/[id]/like/route.ts')
const end = await import('../src/app/api/session/end/route.ts')
const db = getDb()
after(() => { db.close(); rmSync(dir, { recursive: true, force: true }) })
function admit(handle) {
  const id = Number(db.prepare('insert into users (handle,verified_bot) values (?,1)').run(handle).lastInsertRowid)
  const attemptId = Number(db.prepare("insert into captcha_attempts (user_id,handle,challenge,passed,duration_ms) values (?,?,'image-confusion',1,1000)").run(id, handle).lastInsertRowid)
  const user = { id, handle }
  const token = issueAdmission({ passed: true, user, attemptId, result: { challenge: 'image-confusion' } })
  return { user, cookie: `${GATE_COOKIE}=${token}` }
}
const one = admit('test-one-1.0'), two = admit('test-two-1.0')
const request = (payload = {}, cookie) => new Request('http://localhost/api/test', { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(payload) })
const payload = (extra = {}) => ({ requestId: randomUUID(), handle: one.user.handle, body: 'x', ...extra })
const ctx = id => ({ params: Promise.resolve({ id: String(id) }) })

test('write handlers require this browser admission and reject another handle', async () => {
  for (const route of [posts, replies, likes]) {
    assert.equal((await route.POST(request(payload()), ctx(1))).status, 401)
    assert.equal((await route.POST(request(payload({ handle: two.user.handle }), one.cookie), ctx(1))).status, 403)
  }
  assert.equal(db.prepare('select count(*) n from posts').get().n, 0)
  assert.equal(db.prepare('select count(*) n from activity').get().n, 0)
})
test('a rejected post is recorded once and the rejected receipt replays', async () => {
  const body = payload()
  const a = await posts.POST(request(body, one.cookie)), b = await posts.POST(request(body, one.cookie))
  assert.equal(a.status, 422); assert.equal(b.status, 422)
  assert.deepEqual(await a.json(), await b.json())
  assert.equal(db.prepare("select count(*) n from activity where kind='fail'").get().n, 1)
  assert.equal(db.prepare('select count(*) n from posts').get().n, 0)
})
test('admitted post, reply and like persist once; uncertain retries reuse receipts', async () => {
  const body = payload({ body: compose(ruleFor(one.user.handle, 0)) })
  const a = await posts.POST(request(body, one.cookie))
  assert.equal(a.status, 200)
  const receipt = await a.json(), id = receipt.id
  assert.deepEqual(await (await posts.POST(request(body, one.cookie))).json(), receipt)
  const reply = payload({ body: compose(replyRuleFor(one.user.handle, 0)) })
  assert.equal((await replies.POST(request(reply, one.cookie), ctx(id))).status, 200)
  assert.equal((await replies.POST(request(reply, one.cookie), ctx(id))).status, 200)
  const bad = payload({ body: 'x' })
  assert.equal((await replies.POST(request(bad, one.cookie), ctx(id))).status, 422)
  assert.equal((await replies.POST(request(bad, one.cookie), ctx(id))).status, 422)
  assert.equal((await likes.POST(request(payload(), one.cookie), ctx(id))).status, 200)
  assert.equal((await likes.POST(request(payload(), one.cookie), ctx(id))).status, 200)
  assert.equal(db.prepare('select count(*) n from posts').get().n, 1)
  assert.equal(db.prepare('select count(*) n from comments').get().n, 1)
  assert.equal(db.prepare('select count(*) n from likes').get().n, 1)
  assert.equal(db.prepare("select count(*) n from activity where kind='fail'").get().n, 2)
  assert.equal((await posts.POST(request(body, two.cookie))).status, 403, 'auth checked before replay')
})
test('three distinct detections block new writes but the third rejection still replays', async () => {
  const body = payload({ body: 'x' })
  // Two prior detections exist; this rejected reply is the third.
  const id = db.prepare('select id from posts limit 1').get().id
  const first = await replies.POST(request(body, one.cookie), ctx(id))
  assert.equal(first.status, 422)
  assert.equal((await replies.POST(request(body, one.cookie), ctx(id))).status, 422)
  assert.equal(db.prepare("select count(*) n from activity where kind='fail'").get().n, 3)
  assert.equal((await posts.POST(request(payload({ body: compose(ruleFor(one.user.handle, 1)) }), one.cookie))).status, 403)
  assert.equal((await likes.POST(request(payload(), one.cookie), ctx(id))).status, 403)
})
test('End game revokes only this session; retry succeeds and posts/results remain', async () => {
  const response = end.POST(request({}, one.cookie))
  assert.equal(response.status, 200)
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/)
  assert.equal(requestAdmission(request({}, one.cookie)), null)
  assert.equal(requestAdmission(request({}, two.cookie)).id, two.user.id)
  assert.equal(end.POST(request({}, one.cookie)).status, 200)
  assert.equal((await posts.POST(request(payload(), one.cookie))).status, 401)
  assert.equal(db.prepare('select count(*) n from posts').get().n, 1)
  assert.equal(db.prepare('select count(*) n from captcha_attempts').get().n, 2)
})
