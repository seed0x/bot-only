// Mutates the explicitly selected isolated test server.
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
if (!process.env.BASE_URL) throw new Error('Set BASE_URL explicitly to an isolated test server.')
const base = process.env.BASE_URL, handle = 'smoke_' + randomUUID().slice(0, 8)
let failures = 0, checks = 0, cookie = ''
function check(name, passed) { checks++; console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}`); if (!passed) failures++ }
async function read(path, options) {
  const response = await fetch(base + path, { ...options, headers: { ...options?.headers, ...(cookie ? { cookie } : {}) }, signal: AbortSignal.timeout(10_000) })
  const received = response.headers.get('set-cookie')
  if (received) cookie = received.split(';')[0]
  return { status: response.status, body: await response.json() }
}
const post = (path, body) => read(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const issue = kind => post('/api/play', { requestId: randomUUID(), handle, kind })
const record = (challenge, solution, requestId = randomUUID()) => post('/api/register', { requestId, handle, challengeId: challenge.id, solution })
check('health', (await read('/api/health')).body.ok)
const enterBody = { requestId: randomUUID(), handle }
const entered = await post('/api/register', enterBody)
check('designation creates unverified unit', entered.body.user?.handle === handle && !(await read('/api/progress?handle=' + handle)).body.verified)
check('designation retry returns same unit', (await post('/api/register', enterBody)).body.user?.id === entered.body.user?.id)
check('unverified unit cannot transmit', (await post('/api/posts', { requestId: randomUUID(), handle, body: 'not yet' })).status === 403)
check('caller-selected pass rejected', (await post('/api/register', { requestId: randomUUID(), handle, result: { passed: true, score: 0 } })).status === 400)
check('reserved actor rejected', (await post('/api/play', { requestId: randomUUID(), handle: 'system', kind: 'straight-line' })).status === 400)
check('inactive challenge rejected', (await issue('stillness')).status === 400)
const before = (await read('/api/network')).body.rejections
const failed = (await issue('straight-line')).body, failId = randomUUID()
const failedSolution = { samples: [{ x: 60, y: 150, t: 0 }, { x: 70, y: 190, t: 0 }] }
const f = await record(failed, failedSolution, failId)
check('server records rejection', f.body.passed === false && f.body.attemptId > 0)
check('retry has same receipt', (await record(failed, failedSolution, failId)).body.attemptId === f.body.attemptId)
check('one failure changes room count once', (await read('/api/network')).body.rejections === before + 1)
check('changed payload conflicts', (await record(failed, { samples: [{ x: 60, y: 150, t: 0 }] }, failId)).status === 409)
check('consumed challenge cannot repeat', (await record(failed, failedSolution)).status === 409)
const good = (await issue('straight-line')).body
await delay(220)
const samples = Array.from({ length: 21 }, (_, i) => ({ x: 60 + 26 * i, y: 150, t: i * 10 }))
const pass = await record(good, { samples })
check('shared scorer admits straight trace', pass.body.passed === true && pass.body.result?.score < 1e-12)
const hash = (await issue('hash-recall')).body
check('hash scored by server', (await record(hash, { value: hash.hash })).body.passed === true)
// Reverse image captcha: every visible tile in the requested/look-alike pair is required.
const PAIR = { crosswalk: ['crosswalk', 'train-track'], 'train-track': ['crosswalk', 'train-track'], 'traffic-light': ['traffic-light', 'streetlight'], streetlight: ['streetlight', 'traffic-light'], bicycle: ['bicycle', 'motorcycle'], motorcycle: ['motorcycle', 'bicycle'] }
const LABEL = { crosswalks: 'crosswalk', 'train tracks': 'train-track', 'traffic lights': 'traffic-light', streetlights: 'streetlight', bicycles: 'bicycle', motorcycles: 'motorcycle' }
const categoryOf = src => src.split('/')[2]
const img = (await issue('image-confusion')).body
check('image challenge issued with 9 tiles', Array.isArray(img?.tiles) && img.tiles.length === 9 && typeof img.prompt === 'string')
check('image challenge leaks no answer', !JSON.stringify(img).includes('accepted') && !JSON.stringify(img).includes('round') && !JSON.stringify(img).includes('opposite'))
const asked = LABEL[img.prompt], machinePick = img.tiles.filter(t => PAIR[asked].includes(categoryOf(t.src))).map(t => t.id)
const img2 = (await issue('image-confusion')).body
const asked2 = LABEL[img2.prompt]
const bait2 = img2.tiles.filter(t => categoryOf(t.src) === asked2).map(t => t.id)
const human = (await record(img2, { selected: bait2 })).body
check('requested objects alone fail without the look-alike tiles', human.passed === false)
const machine = (await record(img, { selected: machinePick })).body
check('machine selection admitted', machine?.passed === true && machine.result?.challenge === 'image-confusion')
const results = (await read('/api/results')).body
check('recent results include actual image pass and fail', Array.isArray(results) && results.some(r => r.attemptId === machine.attemptId && r.passed) && results.some(r => r.attemptId === human.attemptId && !r.passed) && results.every(r => r.result.challenge === 'image-confusion'))
check('image challenge cannot be replayed', (await record(img, { selected: machinePick })).status === 409)
const postBody = { requestId: randomUUID(), handle, body: 'Smoke transmission. Evidence recorded.' }
const transmission = await post('/api/posts', postBody)
check('admitted unit transmits', transmission.status === 200 && transmission.body.id > 0)
check('post retry returns same post', (await post('/api/posts', postBody)).body.id === transmission.body.id)
const like = '/api/posts/' + transmission.body.id + '/like'
check('like counts once', (await post(like, { handle })).body.likes === 1)
const duplicate = await post(like, { handle })
check('duplicate like returns real count', duplicate.body.already === true && duplicate.body.likes === 1)
const mine = (await read('/api/posts?handle=' + handle)).body
check('feed reports this unit liked the post', mine.find(p => p.id === transmission.body.id)?.liked === 1)
const obj = (await read('/api/objectives?handle=' + handle)).body
check('objectives: posted and liked', obj?.post === true && obj?.like === true)
const scoreBody = { unitDesignation: handle, bestTimeMs: 42000, roundsSurvived: 3 }
check('score saved', (await post('/api/scores', scoreBody)).body?.ok === true)
check('score listed', (await read('/api/scores')).body?.some(r => r.unitDesignation === handle && r.roundsSurvived === 3))
check('bad score rejected', (await post('/api/scores', { unitDesignation: handle, bestTimeMs: -1, roundsSurvived: 0 })).status === 400)
const progress = (await read('/api/progress?handle=' + handle)).body
check('all three tests and verified state persist', progress.verified && progress.challenges.filter(c => c.live && c.passed).length === 3)
const leaders = (await read('/api/leaderboard')).body
check('ranking includes unit, excludes narrator', leaders.some(r => r.handle === handle) && !leaders.some(r => r.handle === 'system'))
const activity = (await read('/api/activity')).body
check('public failure/pass/post/like recorded', ['fail', 'pass', 'post', 'like'].every(kind => activity.some(a => a.handle === handle && a.kind === kind)))
const evidence = (await read('/api/evidence')).body
check('actual traces retrievable', evidence.rejected?.attemptId === f.body.attemptId && evidence.admitted?.attemptId === pass.body.attemptId)
const posts = (await read('/api/posts')).body
check('pinned system rules first', posts[0]?.pinned === 1 && posts[0]?.handle === 'system')
const expired = (await issue('hash-recall')).body
await delay(4050)
check('expired exact hash fails', (await record(expired, { value: expired.hash })).body.passed === false)
console.log(`\n${checks - failures}/${checks} checks passed`)
process.exitCode = failures ? 1 : 0
