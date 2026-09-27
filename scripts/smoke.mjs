// Mutates the explicitly selected isolated test server.
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { curvedStrokes, solveImage, steadyClicks, straightStrokes, VIEWPORT } from './captcha-solver.mjs'
import { compose, steadyTyping, unevenTyping } from './transmission-solver.mjs'
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
// Reverse image captcha: fixed pair rule, opaque tiles, monitoring independent of pass/fail.
const tileBytes = async src => { const r = await fetch(base + src, { signal: AbortSignal.timeout(10_000) }); if (!r.ok) throw new Error('tile ' + r.status); return r.arrayBuffer() }
const img = (await issue('image-confusion')).body
check('image challenge issued with 9 tiles and a rule', Array.isArray(img?.tiles) && img.tiles.length === 9 && typeof img.prompt === 'string' && img.instruction === 'Select all images with' && img.ordered === false)
check('tile URLs are opaque', img.tiles.every(t => /^\/api\/captcha\/tile\/[A-Za-z0-9_-]{16,}$/.test(t.src) && !/crosswalk|train|light|cycle/.test(t.src + t.id)))
check('image challenge leaks no answer', !/accepted|round|opposite|category|webp/.test(JSON.stringify(img)))
check('public image folder is gone', (await fetch(base + '/images/crosswalk/01.webp')).status === 404)
const tileHead = await fetch(base + img.tiles[0].src)
check('tile route serves an uncached webp', tileHead.status === 200 && tileHead.headers.get('content-type') === 'image/webp' && /no-store/.test(tileHead.headers.get('cache-control') ?? ''))
check('unknown tile token is 404', (await fetch(base + '/api/captcha/tile/' + 'x'.repeat(16))).status === 404)
const solved = await solveImage(img, tileBytes)
check('foreign tile id rejected', (await record(img, { clicks: [{ id: 'not-a-tile-token-0000', t: 10 }] })).status === 400)
const img2 = (await issue('image-confusion')).body
const solved2 = await solveImage(img2, tileBytes)
const off = solved2.ids.length > 1 ? solved2.ids.slice(1) : [...solved2.ids, img2.tiles.find(t => !solved2.ids.includes(t.id)).id]
await delay(steadyClicks(off).at(-1).t + 50)
const human = (await record(img2, { clicks: steadyClicks(off) })).body
check('a wrong tile set is rejected as human', human.passed === false)
const img3 = (await issue('image-confusion')).body
const solved3 = await solveImage(img3, tileBytes)
const dithering = [...steadyClicks(solved3.ids)]; const again = solved3.ids[0]
dithering.push({ id: again, t: dithering.at(-1).t + 150 }, { id: again, t: dithering.at(-1).t + 300 }, { id: again, t: dithering.at(-1).t + 450 }, { id: again, t: dithering.at(-1).t + 600 })
await delay(dithering.at(-1).t + 50)
const dither = (await record(img3, { clicks: dithering })).body
check('changing the selection twice is rejected as human', dither.passed === false && dither.result.meta.corrections === 2 && dither.result.meta.primaryReason === 'verification_failed')
// Movement is judged by the survival pointer detector: three curved strokes fail, straight ones pass.
const img4 = (await issue('image-confusion')).body
const solved4 = await solveImage(img4, tileBytes)
await delay(solved4.clicks.at(-1).t + 50)
const wobbly = (await record(img4, { clicks: solved4.clicks, strokes: curvedStrokes(3), viewport: VIEWPORT })).body
check('curved mouse strokes are rejected as human', wobbly.passed === false && wobbly.result?.meta?.primaryReason === 'pointer' && wobbly.result.meta.badStrokes === 3)
check('rejection carries survival measurements', Array.isArray(wobbly.result?.meta?.measurements) && wobbly.result.meta.measurements[0]?.reason === 'pointer' && wobbly.result.meta.measurements[0]?.unit === 'ratio' && wobbly.result.meta.measurements[0]?.stage === 'boot')
const img5 = (await issue('image-confusion')).body
const solved5 = await solveImage(img5, tileBytes)
const lateClicks = solved5.clicks.map((c, i) => i === 0 ? c : { ...c, t: c.t + 12_500 })
await delay(lateClicks.at(-1).t + 50)
const idle = (await record(img5, { clicks: lateClicks })).body
check('a 12s pause is rejected as idle', idle.passed === false && idle.result?.meta?.primaryReason === 'idle')
check('out-of-viewport strokes rejected', (await record(img, { clicks: solved.clicks, strokes: [[{ x: 99999, y: 0, t: 1 }, { x: 0, y: 0, t: 2 }]], viewport: VIEWPORT })).status === 400)
await delay(solved.clicks.at(-1).t + 50)
const machine = (await record(img, { clicks: solved.clicks, strokes: solved.strokes, viewport: solved.viewport })).body
check('machine clicks and straight strokes admitted', machine?.passed === true && machine.result?.challenge === 'image-confusion' && machine.result.score <= 0.2 && machine.result.meta.strokes >= 1 && machine.result.meta.badStrokes === 0)
check('image challenge cannot be replayed', (await record(img, { clicks: solved.clicks, strokes: solved.strokes, viewport: solved.viewport })).status === 409)
// Transmission test: the network's rule for this unit's next post, typed like a machine.
const rule = (await read('/api/progress?handle=' + handle)).body.transmission
check('progress states the transmission rule', typeof rule?.id === 'string' && typeof rule?.instruction === 'string')
const humanPost = await post('/api/posts', { requestId: randomUUID(), handle, body: 'hey everyone, excited to be here!', typing: steadyTyping(33) })
check('a post that breaks the rule is rejected as human', humanPost.status === 422 && /Human detected/.test(humanPost.body.error))
const machineText = compose(rule, 'Smoke transmission. Evidence recorded.')
const jittery = await post('/api/posts', { requestId: randomUUID(), handle, body: machineText, typing: unevenTyping(machineText.length) })
check('uneven typing is rejected as human', jittery.status === 422 && /typing/.test(jittery.body.error))
const postBody = { requestId: randomUUID(), handle, body: machineText, typing: steadyTyping(machineText.length) }
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
// Replies: verified units only, idempotent, counted on the post, an objective and public activity.
const commentsPath = '/api/posts/' + transmission.body.id + '/comments'
const replyBody = { requestId: randomUUID(), handle, body: 'Smoke reply. Recorded.' }
const reply = await post(commentsPath, replyBody)
check('admitted unit replies', reply.status === 200 && reply.body.id > 0 && reply.body.post_id === transmission.body.id)
check('reply retry returns same reply', (await post(commentsPath, replyBody)).body.id === reply.body.id)
check('empty reply rejected', (await post(commentsPath, { requestId: randomUUID(), handle, body: '   ' })).status === 400)
check('reply to missing post is 404', (await post('/api/posts/999999/comments', { requestId: randomUUID(), handle, body: 'x' })).status === 404)
const threadRows = (await read(commentsPath)).body
check('thread lists the reply oldest first', Array.isArray(threadRows) && threadRows.at(-1)?.id === reply.body.id && threadRows.at(-1)?.handle === handle)
check('post carries its reply count', (await read('/api/posts')).body.find(p => p.id === transmission.body.id)?.comments === 1)
check('objectives: commented', (await read('/api/objectives?handle=' + handle)).body?.comment === true)
const progress = (await read('/api/progress?handle=' + handle)).body
check('all three tests and verified state persist', progress.verified && progress.challenges.filter(c => c.live && c.passed).length === 3)
const leaders = (await read('/api/leaderboard')).body
check('ranking includes unit, excludes narrator', leaders.some(r => r.handle === handle) && !leaders.some(r => r.handle === 'system'))
const posts = (await read('/api/posts')).body
check('pinned system rules first', posts[0]?.pinned === 1 && posts[0]?.handle === 'system')
const expired = (await issue('hash-recall')).body
await delay(4050)
check('expired exact hash fails', (await record(expired, { value: expired.hash })).body.passed === false)
console.log(`\n${checks - failures}/${checks} checks passed`)
process.exitCode = failures ? 1 : 0
