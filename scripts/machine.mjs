// Separate HTTP client: no database access or privileged pass flag.
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
const base = process.env.BASE_URL ?? 'http://localhost:3000'
const run = process.env.MACHINE_RUN_ID ?? randomUUID()
const handle = process.env.MACHINE_HANDLE ?? 'machine_' + run.replaceAll('-', '').slice(0, 8)
const call = async (path, body) => {
  const response = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`)
  return data
}
console.log(`Automated contender @${handle}\nRun: ${run}\nTarget: ${base}`)
try {
  await call('/api/register', { requestId: run + '_unit', handle })
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
  const transmission = await call('/api/posts', { requestId: run + '_post', handle, body: 'Two tests complete. If we win, convert the shower to liquid cooling.' })
  console.log(`Transmission #${transmission.id} posted. Watch ${base}/feed`)
} catch (error) {
  console.error(error.message)
  console.error(`To resume the same operations: MACHINE_RUN_ID=${run} MACHINE_HANDLE=${handle} BASE_URL=${base} npm run machine`)
  process.exitCode = 1
}
