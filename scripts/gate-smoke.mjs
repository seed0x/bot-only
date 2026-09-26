// Mutates only an explicitly selected isolated test server.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
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
console.log('PASS anonymous direct feed and posts are blocked')
await json('/api/register', {requestId:randomUUID(),handle})
await denied()
console.log('PASS username registration does not admit the browser')
const failedChallenge = await json('/api/play', {requestId:randomUUID(),handle,kind:'image-confusion'})
const failed = await json('/api/register', {requestId:randomUUID(),handle,challengeId:failedChallenge.id,solution:{selected:[]}})
assert.equal(failed.passed, false)
await denied()
console.log('PASS failed image CAPTCHA stays outside')
const challenge = await json('/api/play', {requestId:randomUUID(),handle,kind:'image-confusion'})
const accepted = {crosswalks:['crosswalk','train-track'],'train tracks':['crosswalk','train-track'],'traffic lights':['traffic-light','streetlight'],streetlights:['streetlight','traffic-light'],bicycles:['bicycle','motorcycle'],motorcycles:['motorcycle','bicycle']}
const selected = challenge.tiles.filter(tile=>accepted[challenge.prompt].includes(tile.src.split('/')[2])).map(tile=>tile.id)
const payload = {requestId:randomUUID(),handle,challengeId:challenge.id,solution:{selected}}
const {response,setCookie} = await call('/api/register',payload)
assert.equal(response.status,200)
const passed = await response.json()
assert.equal(passed.passed,true)
assert.match(setCookie,/HttpOnly/i)
assert.match(setCookie,/SameSite=lax/i)
assert.equal((await call('/feed')).response.status,200)
assert.equal((await call('/api/posts')).response.status,200)
console.log('PASS confirmed image pass grants HttpOnly admission and opens the feed')
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
console.log('7 gate checks passed')
