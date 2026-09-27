// Separate HTTP client: no database access or privileged pass flag.
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { solveImage } from './captcha-solver.mjs'
import { compose, steadyTyping } from './transmission-solver.mjs'
const base = process.env.BASE_URL ?? 'http://localhost:3000'
const run = process.env.MACHINE_RUN_ID ?? randomUUID()
const handle = process.env.MACHINE_HANDLE ?? 'machine_' + run.replaceAll('-', '').slice(0, 8)
let cookie = ''  // the gate's admission cookie, kept like a browser would
const call = async (path, body) => {
  const response = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) })
  const received = response.headers.get('set-cookie')
  if (received) cookie = received.split(';')[0]
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`)
  return data
}
console.log(`Automated contender @${handle}\nRun: ${run}\nTarget: ${base}`)
try {
  await call('/api/register', { requestId: run + '_unit', handle })
  const gate = await call('/api/play', { requestId: run + '_issue_gate', handle, kind: 'image-confusion' })
  const solved = await solveImage(gate, async src => (await fetch(base + src, { signal: AbortSignal.timeout(10_000) })).arrayBuffer())
  await delay(solved.clicks.at(-1).t + 50)
  const admitted = await call('/api/register', { requestId: run + '_gate', handle, challengeId: gate.id, solution: { clicks: solved.clicks, strokes: solved.strokes, viewport: solved.viewport } })
  if (!admitted.passed) throw new Error('Gate rejected: ' + admitted.result.meta.reason)
  console.log(`Reverse captcha (${solved.rule}: ${gate.instruction.toLowerCase()} ${gate.prompt}) passed as #${admitted.attemptId}; humanity ${admitted.result.score.toFixed(2)}`)
  const motion = await call('/api/play', { requestId: run + '_issue_line', handle, kind: 'straight-line' })
  const samples = Array.from({ length: 61 }, (_, i) => ({ x: 60 + 520 * i / 60, y: 150, t: i * 15 }))
  await delay(910)
  const line = await call('/api/register', { requestId: run + '_line', handle, challengeId: motion.id, solution: { samples } })
  if (!line.passed) throw new Error('Motion rejected: ' + line.result.meta.reason)
  console.log(`Straight line recorded as #${line.attemptId}; humanity ${line.result.score.toFixed(2)}`)
  const hash = await call('/api/play', { requestId: run + '_issue_hash', handle, kind: 'hash-recall' })
  const recall = await call('/api/register', { requestId: run + '_hash', handle, challengeId: hash.id, solution: { value: hash.hash } })
  if (!recall.passed) throw new Error('Hash rejected: ' + recall.result.meta.reason)
  console.log(`Hash recall recorded as #${recall.attemptId}; ${recall.result.duration_ms}ms server elapsed`)
  const rule = (await (await fetch(`${base}/api/progress?handle=${handle}`)).json()).transmission
  const text = compose(rule)
  const transmission = await call('/api/posts', { requestId: run + '_post', handle, body: text, typing: steadyTyping(text.length) })
  console.log(`Transmission rule: ${rule.instruction}`)
  console.log(`Transmission #${transmission.id} posted. Watch ${base}/feed`)
} catch (error) {
  console.error(error.message)
  console.error(`To resume the same operations: MACHINE_RUN_ID=${run} MACHINE_HANDLE=${handle} BASE_URL=${base} npm run machine`)
  process.exitCode = 1
}
