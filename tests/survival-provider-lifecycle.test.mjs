import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { register } from 'node:module'
import ts from 'typescript'
import { SURVIVAL_RULES_VERSION } from '../src/lib/survival/config.ts'

// Execute the actual provider effect with a minimal hook host, without a DOM renderer.
// Replay setup -> cleanup -> setup, the lifecycle exercised by development Strict Mode.
const providerPath = new URL('../src/components/game/GameProvider.tsx', import.meta.url)
const compiled = ts.transpileModule(readFileSync(providerPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const providerUrl = 'data:text/javascript,' + encodeURIComponent(compiled)
const hookUrl = 'data:text/javascript,' + encodeURIComponent(`
export const createContext = () => ({Provider: 'provider'});
export const useContext = () => null;
export const useRef = value => ({current: value});
export const useState = initial => [typeof initial === 'function' ? initial() : initial, value => globalThis.__survivalHost.updates.push(value)];
export const useCallback = fn => fn;
export const useEffect = fn => globalThis.__survivalHost.effects.push(fn);
`)
const jsxUrl = 'data:text/javascript,' + encodeURIComponent('export const jsx = (type, props) => ({type, props}); export const jsxs = jsx;')
const navUrl = 'data:text/javascript,' + encodeURIComponent("export const usePathname = () => '/feed';")
const childUrl = 'data:text/javascript,' + encodeURIComponent('export default function Child() { return null; }')
const sessionUrl = 'data:text/javascript,' + encodeURIComponent('export const getSessionUser = () => globalThis.__survivalHost.user ?? null;')
const libRoot = new URL('../src/lib/', import.meta.url).href
register('data:text/javascript,' + encodeURIComponent(`
export function resolve(specifier, context, nextResolve) {
  const mocks = ${JSON.stringify({ '@/lib/session': sessionUrl, react: hookUrl, 'react/jsx-runtime': jsxUrl, 'next/navigation': navUrl, './GameHud': childUrl, './GameOver': childUrl, '../feed/LeaderboardPanel': childUrl })};
  if (context.parentURL === ${JSON.stringify(providerUrl)}) {
    if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true };
    if (specifier.startsWith('@/lib/')) return { url: ${JSON.stringify(libRoot)} + specifier.slice(6) + '.ts', shortCircuit: true };
  }
  if (specifier.startsWith('@/')) return { url: ${JSON.stringify(new URL('../src/', import.meta.url).href)} + specifier.slice(2) + '.ts', shortCircuit: true };
  if (context.parentURL?.startsWith(${JSON.stringify(libRoot)}) && specifier.startsWith('.') && !specifier.endsWith('.ts')) specifier += '.ts';
  return nextResolve(specifier, context);
}`), import.meta.url)
const { default: GameProvider } = await import(providerUrl)

class TrackedTarget extends EventTarget {
  listeners = new Map()
  addEventListener(type, fn, options) {
    let listeners = this.listeners.get(type)
    if (!listeners) this.listeners.set(type, listeners = new Set())
    listeners.add(fn); super.addEventListener(type, fn, options)
  }
  removeEventListener(type, fn, options) {
    this.listeners.get(type)?.delete(fn); super.removeEventListener(type, fn, options)
  }
  count() { return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0) }
}
function host(checkpoint = null) {
  let now = 0, id = 0
  const timers = new Map(), document = new TrackedTarget(), window = new TrackedTarget()
  Object.assign(document, { hidden: false, hasFocus: () => true })
  Object.assign(window, { innerWidth: 1000, innerHeight: 800,
    setInterval: fn => { timers.set(++id, fn); return id } })
  const originals = Object.fromEntries(['window', 'document', 'performance', 'sessionStorage', 'clearInterval', 'fetch'].map(key => [key, globalThis[key]]))
  globalThis.__survivalHost = { effects: [], updates: [], requests: [], user: null, fetch: null }
  let stored = checkpoint
  Object.assign(globalThis, { document, window, performance: { now: () => now },
    sessionStorage: { getItem: () => stored, setItem: (_key, value) => { stored = value }, removeItem: () => { stored = null } },
    clearInterval: timer => timers.delete(timer),
    fetch: async (url, options = {}) => {
      const body = options.body ? JSON.parse(options.body) : null
      globalThis.__survivalHost.requests.push({ url, body })
      if (globalThis.__survivalHost.fetch) return globalThis.__survivalHost.fetch(url, body)
      return Response.json({ ...body, ok: true, runId: 'server_run_000000001', startedAt: '2026-09-26T00:00:00.000Z' })
    } })
  const tree = GameProvider({ children: null })
  const value = tree.props.value
  const [setup, route] = globalThis.__survivalHost.effects
  return { document, window, timers, value, setup, route, panel: tree.props.children.at(-1).props,
    tick: time => { now = time; [...timers.values()].forEach(fn => fn()) },
    updates: globalThis.__survivalHost.updates, network: globalThis.__survivalHost, now: time => { now = time },
    state: () => globalThis.__survivalHost.updates.filter(value => value?.phase).at(-1),
    restore: () => { Object.assign(globalThis, originals); delete globalThis.__survivalHost } }
}

test('provider Strict Mode effect replay leaves one timer/listener set and preserves the run', async () => {
  const h = host()
  let cleanup
  try {
    cleanup = h.setup(); h.route()
    const documentCount = h.document.count(), windowCount = h.window.count()
    assert.ok(documentCount > 0); assert.equal(windowCount, 4); assert.equal(h.timers.size, 1)
    await h.value.start('pointer'); h.tick(3000); h.tick(3100)
    cleanup()
    assert.equal(h.timers.size, 0); assert.equal(h.document.count(), 0); assert.equal(h.window.count(), 0)
    cleanup = h.setup(); h.route()
    assert.equal(h.document.count(), documentCount); assert.equal(h.window.count(), windowCount); assert.equal(h.timers.size, 1)
    const before = h.updates.length
    h.tick(3200)
    const states = h.updates.slice(before).filter(value => value?.phase)
    assert.equal(states.length, 1)
    assert.equal(states[0].phase, 'running'); assert.equal(states[0].activeMs, 200)
    cleanup()
    const after = h.updates.length
    h.document.dispatchEvent(new Event('visibilitychange')); h.window.dispatchEvent(new Event('blur')); h.tick(3300)
    assert.equal(h.updates.length, after)
    assert.equal(h.timers.size, 0); assert.equal(h.document.count(), 0); assert.equal(h.window.count(), 0)
  } finally { cleanup?.(); h.restore() }
})

test('checkpoint restoration stays interrupted through effect replay without duplicate timers', () => {
  const h = host(JSON.stringify({ run: { runId: 'local_test_checkpoint', rulesVersion: SURVIVAL_RULES_VERSION, inputMode: 'pointer' }, activeMs: 1234 }))
  let cleanup
  try {
    cleanup = h.setup(); cleanup(); cleanup = h.setup()
    assert.equal(h.timers.size, 1)
    h.tick(4000)
    const states = h.updates.filter(value => value?.phase)
    assert.ok(states.length > 0)
    assert.ok(states.every(state => state.phase === 'ended' && state.terminal.status === 'interrupted' && state.activeMs === 1234))
  } finally { cleanup?.(); h.restore() }
})

const isPostReceipt = value => !!value && typeof value.id === 'number'
const completion = (body, action) => ({ runId: body.game.runId, objectiveId: body.game.objectiveId, requestId: body.requestId,
  completionId: 'completion_000000001', user: { id: 1, handle: body.handle }, action, recordedAt: '2026-09-26T00:00:00.000Z' })
const verifiedNetwork = h => {
  h.network.user = { id: 1, handle: 'verified' }
  h.network.fetch = (url, body) => {
    if (url.startsWith('/api/progress')) return Response.json({ humanity: 0, verified: true, challenges: [] })
    if (url.endsWith('/bind')) return Response.json({ ...body, ok: true, runId: 'server_run_000000001', user: h.network.user })
    return Response.json({ ...body, ok: true, runId: 'server_run_000000001', startedAt: '2026-09-26T00:00:00.000Z' })
  }
}

test('verified Start waits for acknowledged bind and issues post; failed Start retries the identical request', async () => {
  const h = host(); const cleanup = h.setup()
  try {
    verifiedNetwork(h)
    let dropped = true
    const normal = h.network.fetch
    h.network.fetch = (url, body) => {
      if (url === '/api/runs' && dropped) { dropped = false; throw new Error('response lost') }
      return normal(url, body)
    }
    await h.value.start('pointer')
    assert.equal(h.state().phase, 'ready'); assert.equal(h.state().run, null)
    await h.value.start('touch_or_keyboard')
    const starts = h.network.requests.filter(r => r.url === '/api/runs')
    assert.deepEqual(starts[0].body, starts[1].body)
    assert.equal(h.state().run.inputMode, 'pointer')
    assert.equal(h.state().user.handle, 'verified')
    assert.equal(h.state().objective.kind, 'post')
    assert.equal(h.state().objective.deadlineActiveMs, 35000)
    assert.equal(h.state().phase, 'countdown')
  } finally { cleanup(); h.restore() }
})

test('lost mutation response pauses clocks; exact Retry advances once and continues immediately', async () => {
  const h = host(); const cleanup = h.setup()
  try {
    verifiedNetwork(h); await h.value.start('pointer'); h.value.targets([{ id: 9, liked: 0 }])
    h.tick(3000); h.tick(3100)
    let dropped = true
    h.network.fetch = (_url, body) => {
      if (dropped) { dropped = false; throw new Error('accepted response lost') }
      return Response.json({ id: 42, completion: completion(body, { kind: 'post', postId: 42 }) })
    }
    const input = { requestId: 'post_request_00000001', handle: 'verified', body: 'draft' }
    await assert.rejects(h.value.mutate('/api/posts', input, 'post', isPostReceipt), /lost/)
    const paused = h.state()
    assert.equal(paused.phase, 'paused'); assert.ok(paused.pendingObjective)
    const objectiveId = paused.objective.objectiveId
    h.tick(100000)
    assert.equal(h.state().activeMs, paused.activeMs)
    await assert.rejects(h.value.mutate('/api/posts', { ...input, body: 'changed' }, 'post', isPostReceipt), /unchanged/)
    await h.value.mutate('/api/posts', input, 'post', isPostReceipt)
    assert.equal(h.state().completedObjectiveIds.length, 1)
    assert.equal(h.state().completedObjectiveIds[0], objectiveId)
    assert.equal(h.state().objective.kind, 'like')
    assert.deepEqual(h.state().objective.eligiblePostIds, [9])
    assert.equal(h.state().phase, 'running')
    assert.equal(h.state().activeMs, paused.activeMs)
    const writes = h.network.requests.filter(r => r.url === '/api/posts')
    assert.equal(writes.length, 2); assert.deepEqual(writes[0].body, writes[1].body)
    await h.value.mutate('/api/posts', input, 'post', isPostReceipt)
    assert.equal(h.network.requests.filter(r => r.url === '/api/posts').length, 2)
    assert.equal(h.state().completedObjectiveIds.length, 1)
    h.tick(100100)
    assert.equal(h.state().activeMs, paused.activeMs + 100)
    h.network.fetch = (_url, body) => Response.json({ ok: true, already: false, likes: 1, completion: completion(body, { kind: 'like', likeId: 12, postId: 9 }) })
    await h.value.mutate('/api/posts/9/like', { requestId: 'like_request_00000001', handle: 'verified' }, 'like', v => v?.ok === true, 9)
    assert.equal(h.state().completedObjectiveIds.length, 2); assert.equal(h.state().objective.kind, 'post')
    const totalRequests = h.network.requests.length
    await h.value.mutate('/api/posts', input, 'post', isPostReceipt)
    assert.equal(h.network.requests.length, totalRequests); assert.equal(h.state().completedObjectiveIds.length, 2)
  } finally { cleanup(); h.restore() }
})

test('required feed data pauses; empty or disappeared like targets replace with a new full-budget post', async () => {
  const h = host(); const cleanup = h.setup()
  try {
    verifiedNetwork(h); await h.value.start('pointer'); h.tick(3000)
    h.network.fetch = (_url, body) => Response.json({ id: 42, completion: completion(body, { kind: 'post', postId: 42 }) })
    await h.value.mutate('/api/posts', { requestId: 'post_resource_0000001', handle: 'verified', body: 'draft' }, 'post', isPostReceipt)
    assert.ok(h.state().pauseReasons.includes('required_resource'))
    assert.equal(h.state().objective, null)
    h.value.targets([])
    assert.equal(h.state().objective.kind, 'post'); assert.equal(h.state().objective.deadlineActiveMs - h.state().activeMs, 35000)
    assert.ok(!h.state().pauseReasons.includes('required_resource'))
    h.value.resume(); h.tick(6000)
    h.value.targets([{ id: 9, liked: 0 }, { id: 10, liked: 0 }])
    await h.value.mutate('/api/posts', { requestId: 'post_resource_0000002', handle: 'verified', body: 'next' }, 'post', isPostReceipt)
    assert.equal(h.state().objective.kind, 'like')
    const retired = h.state().objective.objectiveId
    h.value.targets([{ id: 11, liked: 0 }])
    assert.equal(h.state().objective.kind, 'post'); assert.notEqual(h.state().objective.objectiveId, retired)
    assert.equal(h.state().objective.deadlineActiveMs - h.state().activeMs, 35000)
  } finally { cleanup(); h.restore() }
})

test('definite mutation rejection preserves objective and budget; malformed success remains uncertain', async () => {
  const h = host(); const cleanup = h.setup()
  try {
    verifiedNetwork(h); await h.value.start('pointer'); h.tick(3000); h.tick(3100)
    const original = h.state().objective
    h.network.fetch = () => Response.json({ error: 'rejected' }, { status: 403 })
    const input = { requestId: 'post_rejected_0000001', handle: 'verified', body: 'draft' }
    await assert.rejects(h.value.mutate('/api/posts', input, 'post', isPostReceipt), /rejected/)
    assert.equal(h.state().objective.objectiveId, original.objectiveId)
    assert.equal(h.state().pendingObjective, null); assert.equal(h.state().phase, 'paused')
    assert.equal(h.state().activeMs, 100)
    h.value.resume(); h.tick(6100)
    h.network.fetch = () => Response.json({ id: 42 })
    await assert.rejects(h.value.mutate('/api/posts', input, 'post', isPostReceipt), /confirm/)
    assert.ok(h.state().pendingObjective); assert.equal(h.state().completedObjectiveIds.length, 0)
  } finally { cleanup(); h.restore() }
})

test('objective deadline ends an active run despite continued activity; equality is still eligible', async () => {
  const h = host(); const cleanup = h.setup()
  try {
    verifiedNetwork(h); await h.value.start('pointer'); h.tick(3000)
    // Fixture callbacks emulate qualified browser activity; they are not real-device evidence.
    for (let time = 8000; time <= 38000; time += 5000) {
      h.now(time)
      for (const fn of h.document.listeners.get('keydown')) fn({ isTrusted: true, repeat: false, key: 'a', target: h.document })
      h.tick(time)
    }
    assert.equal(h.state().phase, 'running'); assert.equal(h.state().activeMs, 35000)
    h.tick(38000.01)
    assert.equal(h.state().phase, 'ended'); assert.equal(h.state().terminal.primaryReason, 'objective_deadline')
    assert.ok(h.state().activeMs > 35000 && h.state().activeMs < 35000.01)
    const snapshot = h.state().terminal
    h.tick(100000)
    assert.deepEqual(h.state().terminal, snapshot)
  } finally { cleanup(); h.restore() }
})

test('admission starts with 60 seconds; confirmed rejection ends it, network error does not', async () => {
  const h = host(); const cleanup = h.setup()
  try {
    await h.value.start('pointer'); h.tick(3000)
    assert.equal(h.state().objective.kind, 'admission'); assert.equal(h.state().objective.deadlineActiveMs, 60000)
    const input = { requestId: 'admit_request_0000001', handle: 'newunit', challengeId: 'challenge_000000001', solution: { selected: [] } }
    h.network.fetch = () => { throw new Error('offline') }
    const valid = v => !!v && typeof v.passed === 'boolean' && typeof v.attemptId === 'number'
    await assert.rejects(h.value.mutate('/api/register', input, 'admission', valid), /offline/)
    assert.equal(h.state().phase, 'paused'); assert.equal(h.state().terminal, null)
    h.network.fetch = () => Response.json({ passed: false, attemptId: 1 })
    await h.value.mutate('/api/register', input, 'admission', valid)
    assert.equal(h.state().phase, 'ended'); assert.equal(h.state().terminal.primaryReason, 'verification_failed')
    assert.equal(h.state().completedObjectiveIds.length, 0)
  } finally { cleanup(); h.restore() }
})

test('a late objective acknowledgement cannot change the next run', async () => {
  const h = host(); const cleanup = h.setup()
  try {
    verifiedNetwork(h); await h.value.start('pointer'); h.tick(3000)
    let resolve
    const normal = h.network.fetch
    h.network.fetch = (_url, body) => new Promise(done => { resolve = () => done(Response.json({ id: 42, completion: completion(body, { kind: 'post', postId: 42 }) })) })
    const old = h.value.mutate('/api/posts', { requestId: 'post_delayed_00000001', handle: 'verified', body: 'old run' }, 'post', isPostReceipt)
    h.network.fetch = (url, body) => {
      if (url === '/api/runs') return Response.json({ ...body, ok: true, runId: 'server_run_000000002', startedAt: '2026-09-26T00:00:00.000Z' })
      if (url.endsWith('/bind')) return Response.json({ ...body, ok: true, runId: 'server_run_000000002', user: h.network.user })
      return normal(url, body)
    }
    await h.value.start('pointer')
    const next = h.state().objective.objectiveId
    resolve(); await assert.rejects(old, { status: 409 })
    assert.equal(h.state().run.runId, 'server_run_000000002')
    assert.equal(h.state().objective.objectiveId, next); assert.equal(h.state().completedObjectiveIds.length, 0)
  } finally { cleanup(); h.restore() }
})

test('overlapping required resources release only their own pause', async () => {
  const h = host(); const cleanup = h.setup()
  try {
    await h.value.start('pointer'); h.tick(3000); h.tick(3100)
    h.value.resource('gate_challenge', true); h.value.resource('feed_identity', true)
    h.tick(20000); assert.equal(h.state().activeMs, 100)
    h.value.resource('gate_challenge', false)
    assert.ok(h.state().pauseReasons.includes('required_resource'))
    h.value.resume(); assert.equal(h.state().phase, 'paused')
    h.value.resource('feed_identity', false)
    assert.ok(!h.state().pauseReasons.includes('required_resource'))
    assert.equal(h.state().phase, 'paused')
    h.value.resume(); assert.equal(h.state().phase, 'countdown')
  } finally { cleanup(); h.restore() }
})

test('uncertain bind retries the same run and binding before monitoring starts', async () => {
  const h = host(); const cleanup = h.setup()
  try {
    verifiedNetwork(h)
    const normal = h.network.fetch
    let lost = true
    h.network.fetch = (url, body) => {
      if (url.endsWith('/bind') && lost) { lost = false; throw new Error('bind reply lost') }
      return normal(url, body)
    }
    await h.value.start('pointer'); assert.equal(h.state().phase, 'ready')
    await h.value.start('pointer')
    assert.equal(h.network.requests.filter(r => r.url === '/api/runs').length, 1)
    const binds = h.network.requests.filter(r => r.url.endsWith('/bind'))
    assert.equal(binds.length, 2); assert.deepEqual(binds[0], binds[1])
    assert.equal(h.state().objective.kind, 'post')
  } finally { cleanup(); h.restore() }
})

test('submission at the deadline is acknowledged and the next objective uses the new stage budget', async () => {
  const h = host(); const cleanup = h.setup()
  try {
    verifiedNetwork(h); await h.value.start('pointer'); h.value.targets([{ id: 9, liked: 0 }]); h.tick(3000)
    for (let time = 8000; time <= 38000; time += 5000) {
      h.now(time)
      for (const fn of h.document.listeners.get('keydown')) fn({ isTrusted: true, repeat: false, key: 'a', target: h.document })
      h.tick(time)
    }
    h.network.fetch = (_url, body) => Response.json({ id: 42, completion: completion(body, { kind: 'post', postId: 42 }) })
    await h.value.mutate('/api/posts', { requestId: 'post_equality_0000001', handle: 'verified', body: 'on time' }, 'post', isPostReceipt)
    const write = h.network.requests.at(-1)
    assert.equal(write.body.game.submittedAtActiveMs, 35000)
    assert.equal(write.body.game.deadlineActiveMs, 35000)
    assert.equal(h.state().completedObjectiveIds.length, 1)
    assert.equal(h.state().objective.stage, 'observe')
    assert.equal(h.state().objective.deadlineActiveMs - h.state().activeMs, 30000)
    assert.equal(h.state().phase, 'running')
  } finally { cleanup(); h.restore() }
})

const saved = h => h.updates.filter(v => ['not_sent', 'saving', 'saved', 'save_error'].includes(v?.status)).at(-1)
const finishResponse = body => ({ ok: true, requestId: body.requestId, runId: body.snapshot.runId, resultId: body.snapshot.runId, ranked: false, recordedAt: '2026-09-26T00:00:00.000Z' })

test('leaderboard entry freezes both budgets; exit and overlapping pause require explicit Resume', async () => {
  const h = host(); const cleanup = h.setup()
  try {
    await h.value.start('pointer'); h.tick(3000); h.tick(3500)
    const objective = h.state().objective
    h.value.openLeaderboard(); h.value.openLeaderboard(); h.tick(100000)
    assert.equal(h.state().activeMs, 500); assert.equal(h.state().idleElapsedMs, 500)
    assert.deepEqual(h.state().objective, objective)
    h.document.hidden = true; h.value.pause('hidden', true); h.panel.onClose()
    assert.deepEqual(h.state().pauseReasons, ['hidden'])
    h.value.resume(); assert.equal(h.state().phase, 'paused')
    h.document.hidden = false; h.value.pause('hidden', false); assert.equal(h.state().phase, 'paused')
    h.value.resume(); h.tick(103000); h.tick(103100)
    assert.equal(h.state().activeMs, 600)
    h.value.openLeaderboard(); h.panel.onClose(); h.panel.onClose()
    assert.deepEqual(h.state().pauseReasons, []); assert.equal(h.state().phase, 'paused')
  } finally { cleanup(); h.restore() }
})

test('Start while browsing rankings retains the pause and cannot accrue time', async () => {
  const h = host(); const cleanup = h.setup()
  try {
    h.value.openLeaderboard(); await h.value.start('pointer'); h.tick(50000)
    assert.equal(h.state().phase, 'paused'); assert.equal(h.state().activeMs, 0)
    assert.ok(h.state().pauseReasons.includes('leaderboard'))
    h.panel.onClose(); h.value.resume(); h.tick(53000)
    assert.equal(h.state().phase, 'running')
  } finally { cleanup(); h.restore() }
})

test('terminal guards all new write kinds, including submission before the next timer pulse', async () => {
  const h = host(); const cleanup = h.setup()
  try {
    await h.value.start('pointer'); h.tick(3000); h.now(15000)
    const before = h.network.requests.length
    for (const [url, kind, body] of [
      ['/api/register', 'admission', { handle: 'tester' }], ['/api/play', 'admission', { handle: 'tester', kind: 'image-confusion' }],
      ['/api/posts', 'post', { body: 'late' }], ['/api/posts/9/like', 'like', {}],
    ]) await assert.rejects(h.value.mutate(url, { requestId: crypto.randomUUID(), ...body }, kind, () => true), { status: 409 })
    assert.equal(h.network.requests.length, before)
    const terminal = h.state().terminal
    h.tick(30000); assert.deepEqual(h.state().terminal, terminal)
  } finally { cleanup(); h.restore() }
})

test('uncertain finish retries the exact snapshot; duplicate save is locked and acknowledged once', async () => {
  const h = host(); const cleanup = h.setup()
  try {
    await h.value.start('pointer'); h.tick(3000); h.tick(15000)
    const terminal = h.state().terminal
    let resolve
    h.network.fetch = () => new Promise(done => { resolve = done })
    const first = h.value.saveResult(); await h.value.saveResult()
    assert.ok(Object.isFrozen(saved(h).request.snapshot))
    assert.throws(() => { saved(h).request.snapshot.measurements[0].value = 0 }, TypeError)
    assert.equal(h.network.requests.filter(r => r.url.endsWith('/finish')).length, 1)
    resolve(Response.json({ error: 'server unavailable' }, { status: 500 })); await first
    assert.equal(saved(h).status, 'save_error'); assert.equal(saved(h).retryable, true)
    h.tick(40000); assert.deepEqual(h.state().terminal, terminal)
    h.network.fetch = (_url, body) => Response.json(finishResponse(body))
    await h.value.saveResult(); await h.value.saveResult()
    const requests = h.network.requests.filter(r => r.url.endsWith('/finish'))
    assert.equal(requests.length, 2); assert.deepEqual(requests[0].body, requests[1].body)
    assert.deepEqual(requests[0].body.snapshot, terminal)
    assert.equal(saved(h).status, 'saved'); assert.equal(saved(h).receipt.ranked, false)
    assert.equal(globalThis.sessionStorage.getItem('checkpoint'), null)
  } finally { cleanup(); h.restore() }
})

test('malformed finish acknowledgement remains retryable; definite rejection stays local', async () => {
  const h = host(); const cleanup = h.setup()
  try {
    await h.value.start('pointer'); h.tick(3000); h.tick(15000)
    h.network.fetch = (_url, body) => Response.json({ ...finishResponse(body), resultId: 'wrong_result_00000001' })
    await h.value.saveResult(); assert.equal(saved(h).status, 'save_error'); assert.equal(saved(h).retryable, true)
    h.network.fetch = () => Response.json({ error: 'invalid snapshot' }, { status: 400 })
    await h.value.saveResult(); assert.equal(saved(h).retryable, false)
    assert.equal(h.state().phase, 'ended')
  } finally { cleanup(); h.restore() }
})

test('old save acknowledgement cannot replace the next run save state or unlock its pending save', async () => {
  const h = host(); const cleanup = h.setup()
  try {
    await h.value.start('pointer'); h.tick(3000); h.tick(15000)
    let resolve
    h.network.fetch = (_url, body) => new Promise(done => { resolve = () => done(Response.json(finishResponse(body))) })
    const old = h.value.saveResult()
    const normal = verifiedNetwork
    normal(h)
    h.network.fetch = (url, body) => {
      if (url.startsWith('/api/progress')) return Response.json({ humanity: 0, verified: true, challenges: [] })
      if (url.endsWith('/bind')) return Response.json({ ...body, ok: true, runId: 'server_run_000000002', user: h.network.user })
      return Response.json({ ...body, ok: true, runId: 'server_run_000000002', startedAt: '2026-09-26T00:00:00.000Z' })
    }
    await h.value.start('pointer'); h.tick(18000); h.tick(30000)
    let resolveNew
    h.network.fetch = (_url, body) => new Promise(done => { resolveNew = () => done(Response.json(finishResponse(body))) })
    const next = h.value.saveResult()
    resolve(); await old
    assert.equal(saved(h).status, 'saving'); assert.equal(saved(h).request.snapshot.runId, 'server_run_000000002')
    const count = h.network.requests.length; await h.value.saveResult(); assert.equal(h.network.requests.length, count)
    resolveNew(); await next; assert.equal(saved(h).receipt.runId, 'server_run_000000002')
  } finally { cleanup(); h.restore() }
})

test('late non-objective replies cannot invoke successful component continuation after terminal state', async () => {
  const h = host(); const cleanup = h.setup()
  try {
    await h.value.start('pointer'); h.tick(3000)
    let resolve
    h.network.fetch = () => new Promise(done => { resolve = done })
    const pending = h.value.mutate('/api/play', { requestId: 'issue_delayed_000001', handle: 'tester', kind: 'image-confusion' }, 'admission', () => true)
    h.tick(15000); const terminal = h.state().terminal
    resolve(Response.json({ id: 'challenge_late_00001' }))
    await assert.rejects(pending, { status: 409 }); assert.deepEqual(h.state().terminal, terminal)
  } finally { cleanup(); h.restore() }
})

test('actual provider finish reconciles response loss with disposable API and ranks one whole run once', async () => {
  const disposable = mkdtempSync(join(tmpdir(), 'survival-g07-'))
  const previousDbPath = process.env.DB_PATH
  process.env.DB_PATH = join(disposable, 'isolated.sqlite')
  let db, cleanup, h
  try {
    const startRoute = await import('../src/app/api/runs/route.ts')
    const bindRoute = await import('../src/app/api/runs/[id]/bind/route.ts')
    const finishRoute = await import('../src/app/api/runs/[id]/finish/route.ts')
    const scoresRoute = await import('../src/app/api/scores/route.ts')
    const { getDb } = await import('../src/lib/db.ts')
    db = getDb()
    const userId = Number(db.prepare('insert into users (handle, verified_bot) values (?, 1)').run('g07_player').lastInsertRowid)
    h = host(); cleanup = h.setup(); h.network.user = { id: userId, handle: 'g07_player' }
    let loseFinish = true
    h.network.fetch = async (url, body) => {
      if (url.startsWith('/api/progress')) return Response.json({ humanity: 0, verified: true, challenges: [] })
      const request = new Request('http://disposable' + url, { method: 'POST', body: JSON.stringify(body) })
      if (url === '/api/runs') return startRoute.POST(request)
      const context = { params: Promise.resolve({ id: url.split('/')[3] }) }
      if (url.endsWith('/bind')) return bindRoute.POST(request, context)
      if (url.endsWith('/finish')) {
        const response = await finishRoute.POST(request, context)
        assert.equal(response.status, 200)
        if (loseFinish) { loseFinish = false; throw new Error('accepted finish response lost') }
        return response
      }
      throw new Error('Unexpected write: ' + url)
    }
    await h.value.start('pointer'); h.tick(3000); h.tick(15000)
    const terminal = h.state().terminal
    await h.value.saveResult(); assert.equal(saved(h).status, 'save_error')
    assert.equal(db.prepare("select count(*) as n from game_runs where terminal_status='failed'").get().n, 1)
    await h.value.saveResult(); await h.value.saveResult()
    assert.equal(saved(h).status, 'saved'); assert.equal(saved(h).receipt.ranked, true)
    const scoreResponse = await scoresRoute.GET(new Request('http://disposable/api/scores?inputMode=pointer'))
    const ranking = await scoreResponse.json()
    assert.equal(ranking.scores.length, 1)
    assert.equal(ranking.scores[0].runId, terminal.runId); assert.equal(ranking.scores[0].activeMs, terminal.activeMs)
    assert.equal(ranking.scores[0].completedObjectives, terminal.completedObjectiveIds.length)
    assert.equal((await (await scoresRoute.GET(new Request('http://disposable/api/scores?inputMode=touch_or_keyboard'))).json()).scores.length, 0)
    const requests = h.network.requests.filter(r => r.url.endsWith('/finish'))
    assert.equal(requests.length, 2); assert.deepEqual(requests[0].body, requests[1].body)
    const before = db.prepare('select count(*) as n from posts').get().n
    await assert.rejects(h.value.mutate('/api/posts', { requestId: crypto.randomUUID(), handle: 'g07_player', body: 'blocked' }, 'post', isPostReceipt), { status: 409 })
    assert.equal(db.prepare('select count(*) as n from posts').get().n, before)
  } finally {
    cleanup?.(); h?.restore(); db?.close(); rmSync(disposable, { recursive: true, force: true })
    if (previousDbPath === undefined) delete process.env.DB_PATH
    else process.env.DB_PATH = previousDbPath
  }
})

test('late objective reply after interruption cannot change the latched terminal snapshot', async () => {
  const h = host(); const cleanup = h.setup()
  try {
    verifiedNetwork(h); await h.value.start('pointer'); h.tick(3000)
    let resolve
    h.network.fetch = (_url, body) => new Promise(done => { resolve = () => done(Response.json({ id: 42, completion: completion(body, { kind: 'post', postId: 42 }) })) })
    const pending = h.value.mutate('/api/posts', { requestId: 'post_late_closed_001', handle: 'verified', body: 'old' }, 'post', isPostReceipt)
    h.window.dispatchEvent(new Event('pagehide')); const terminal = h.state().terminal
    resolve(); await assert.rejects(pending, { status: 409 })
    assert.deepEqual(h.state().terminal, terminal); assert.equal(h.state().completedObjectiveIds.length, 0)
    assert.equal(terminal.status, 'interrupted')
  } finally { cleanup(); h.restore() }
})

test('restored neutral interruption saves only an acknowledged unranked result', async () => {
  const h = host(JSON.stringify({ run: { runId: 'server_checkpoint_001', rulesVersion: SURVIVAL_RULES_VERSION, inputMode: 'pointer' }, activeMs: 1234 }))
  const cleanup = h.setup()
  try {
    h.network.fetch = (_url, body) => Response.json({ ...finishResponse(body), ranked: true })
    await h.value.saveResult(); assert.equal(saved(h).status, 'save_error'); assert.equal(saved(h).retryable, true)
    h.network.fetch = (_url, body) => Response.json(finishResponse(body))
    await h.value.saveResult(); assert.equal(saved(h).status, 'saved'); assert.equal(saved(h).receipt.ranked, false)
    assert.equal(h.network.requests[0].body.snapshot.status, 'interrupted')
    assert.deepEqual(h.network.requests[0].body, h.network.requests[1].body)
    assert.equal(h.state().terminal.interruption, 'reload')
  } finally { cleanup(); h.restore() }
})
