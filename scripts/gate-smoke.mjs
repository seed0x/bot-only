// Mutates only an explicitly selected isolated test server.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { solveImage, steadyClicks, straightStrokes, VIEWPORT } from './captcha-solver.mjs'
if (!process.env.BASE_URL) throw new Error('Set BASE_URL to an isolated test server.')
const base = process.env.BASE_URL
const handle = 'gate_' + randomUUID().slice(0, 8)
let cookie = ''
const call = async (path, body, overrideCookie) => {
  const response = await fetch(base + path, {
    redirect: 'manual', method: body ? 'POST' : 'GET',
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), cookie: overrideCookie ?? cookie },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000),
  })
  const setCookie = response.headers.get('set-cookie')
  if (setCookie && overrideCookie === undefined) cookie = setCookie.split(';')[0]
  return { response, setCookie }
}
const json = async (path, body) => {
  const {response} = await call(path, body)
  assert.equal(response.status, 200, await response.clone().text())
  return response.json()
}
const denied = async () => {
  const {response} = await call('/feed')
  assert.equal(response.status, 307)
  assert.equal(response.headers.get('location'), '/')
  assert.equal((await call('/api/posts')).response.status, 401)
}
await denied()
const anonymousRetry = await call('/?retry=1')
assert.equal(anonymousRetry.response.status, 200)
assert.match(await anonymousRetry.response.text(), /id="designation"/)
console.log('PASS anonymous direct feed and posts are blocked')
await json('/api/register', {requestId:randomUUID(),handle})
await denied()
console.log('PASS username registration does not admit the browser')
const failedChallenge = await json('/api/play', {requestId:randomUUID(),handle,kind:'image-confusion'})
const tileBytes = async src => (await fetch(base + src, { signal: AbortSignal.timeout(10000) })).arrayBuffer()
const wrong = await solveImage(failedChallenge, tileBytes)
const wrongIds = wrong.ids.length > 1 ? wrong.ids.slice(1) : [...wrong.ids, failedChallenge.tiles.find(t => !wrong.ids.includes(t.id)).id]
await delay(steadyClicks(wrongIds).at(-1).t + 50)
const failed = await json('/api/register', {requestId:randomUUID(),handle,challengeId:failedChallenge.id,solution:{clicks:steadyClicks(wrongIds)}})
assert.equal(failed.passed, false)
await denied()
console.log('PASS failed image CAPTCHA stays outside')
const challenge = await json('/api/play', {requestId:randomUUID(),handle,kind:'image-confusion'})
const { clicks } = await solveImage(challenge, tileBytes)
await delay(clicks.at(-1).t + 50)
const payload = {requestId:randomUUID(),handle,challengeId:challenge.id,solution:{clicks, strokes: straightStrokes(clicks.length), viewport: VIEWPORT}}
const {response,setCookie} = await call('/api/register',payload)
assert.equal(response.status,200)
const passed = await response.json()
assert.equal(passed.passed,true)
assert.match(setCookie,/HttpOnly/i)
assert.match(setCookie,/SameSite=lax/i)
assert.equal((await call('/feed')).response.status,200)
assert.equal((await call('/api/posts')).response.status,200)
console.log('PASS confirmed image pass grants HttpOnly admission and opens the feed')
const home = await call('/')
assert.equal(home.response.status, 307)
assert.equal(home.response.headers.get('location'), '/feed')
console.log('PASS admitted users return to the feed from the gate')
const retryGate = await call('/?retry=1')
assert.equal(retryGate.response.status, 200)
const retryHtml = await retryGate.response.text()
assert.doesNotMatch(retryHtml, /gate-leaderboard/)
assert.doesNotMatch(retryHtml, /id="designation"/)
console.log('PASS admitted users can explicitly reopen the CAPTCHA with their identity')
const feedHtml = await (await call('/feed')).response.text()
assert.match(feedHtml, /id="compose"/)
assert.match(feedHtml, /End game/)
assert.doesNotMatch(feedHtml, /Complete verification to post/)
console.log('PASS first feed render has the composer before progress polling')
const extra = await json('/api/play', {requestId:randomUUID(),handle,kind:'hash-recall'})
const extraResult = await call('/api/register', {requestId:randomUUID(),handle,challengeId:extra.id,solution:{value:''}})
assert.equal(extraResult.response.status, 200)
assert.equal((await extraResult.response.json()).passed, false)
assert.equal(extraResult.setCookie, null)
assert.equal((await call('/feed')).response.status, 200)
console.log('PASS failure in another game preserves image admission')

const replay = await json('/api/register',payload)
assert.equal(replay.attemptId,passed.attemptId)
assert.equal((await call('/feed')).response.status,200)
console.log('PASS uncertain-submit retry keeps the same result and restores admission')
assert.equal((await call('/feed',undefined,'bot-only-admission='+'0'.repeat(64))).response.status,307)
assert.equal((await call('/api/posts',undefined,'bot-only-admission='+'0'.repeat(64))).response.status,401)
console.log('PASS forged admission cannot open the feed or posts')
await json('/api/register',{requestId:randomUUID(),handle:'new_'+randomUUID().slice(0,8)})
await denied()
console.log('PASS starting with a new username clears previous admission')
if (process.env.RECEIPT_FIXTURE_PATH) await writeFile(process.env.RECEIPT_FIXTURE_PATH,JSON.stringify({passed,failed}))
console.log('11 gate checks passed')
