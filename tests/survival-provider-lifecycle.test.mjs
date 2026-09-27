import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
const jsxUrl = 'data:text/javascript,' + encodeURIComponent('export const jsx = (type, props) => ({type, props}); export const jsxs = jsx; export const Fragment = "fragment";')
const navUrl = 'data:text/javascript,' + encodeURIComponent("export const usePathname = () => '/feed';")
const childUrl = 'data:text/javascript,' + encodeURIComponent('export default function Child() { return null; }')
const sessionUrl = 'data:text/javascript,' + encodeURIComponent('export const getSessionUser = () => globalThis.__survivalHost.user ?? null;')
const libRoot = new URL('../src/lib/', import.meta.url).href
register('data:text/javascript,' + encodeURIComponent(`
export function resolve(specifier, context, nextResolve) {
  const mocks = ${JSON.stringify({ '@/lib/session': sessionUrl, react: hookUrl, 'react/jsx-runtime': jsxUrl, 'next/navigation': navUrl, './GameHud': childUrl, './GameOver': childUrl })};
  if (context.parentURL === ${JSON.stringify(providerUrl)}) {
    if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true };
    if (specifier.startsWith('@/lib/')) return { url: ${JSON.stringify(libRoot)} + specifier.slice(6) + '.ts', shortCircuit: true };
  }
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
      if (url === '/api/session') return Response.json({ user: globalThis.__survivalHost.user })
      if (globalThis.__survivalHost.fetch) return globalThis.__survivalHost.fetch(url, body)
      return Response.json({ ...body, ok: true, runId: 'server_run_000000001', startedAt: '2026-09-26T00:00:00.000Z' })
    } })
  const tree = GameProvider({ children: null })
  const value = tree.props.value
  const [setup, route] = globalThis.__survivalHost.effects
  return { document, window, timers, value, setup, route,
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

test.skip('checkpoint restoration stays interrupted through effect replay without duplicate timers', () => {
  const h = host(JSON.stringify({ run: { runId: 'server_test_checkpoint', rulesVersion: SURVIVAL_RULES_VERSION, inputMode: 'pointer' }, activeMs: 1234 }))
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
    resolve(); await old
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

test('End game freezes a real run and retries the identical unsaved result before restart', async () => {
  const h = host(), cleanup = h.setup()
  try {
    verifiedNetwork(h); await h.value.start('pointer'); h.tick(3000); h.tick(3200)
    let dropped = true
    const normal = h.network.fetch
    h.network.fetch = (url, body) => {
      if (url.endsWith('/finish')) {
        if (dropped) { dropped = false; throw new Error('lost acknowledgement') }
        return Response.json({ ok: true, requestId: body.requestId, runId: body.snapshot.runId, resultId: body.snapshot.runId, ranked: false, recordedAt: '2026-09-26T00:00:01.000Z' })
      }
      if (url === '/api/session/end') return Response.json({ ok: true })
      return normal(url, body)
    }
    await assert.rejects(h.value.end(), /lost acknowledgement/)
    const terminal = h.state().terminal
    assert.equal(terminal.status, 'interrupted'); assert.equal(terminal.activeMs, 200)
    h.tick(9000); assert.equal(h.state().terminal.activeMs, 200)
    await assert.rejects(h.value.mutate('/api/posts', { requestId: 'ended_request_0000001', handle: 'verified', body: 'must not post' }, 'post', isPostReceipt), /ended/)
    await h.value.saveResult()
    const writes = h.network.requests.filter(r => r.url.endsWith('/finish'))
    assert.equal(writes.length, 2); assert.deepEqual(writes[0].body, writes[1].body)
    await h.value.restart()
    assert.equal(h.network.requests.at(-1).url, '/api/session/end')
  } finally { cleanup(); h.restore() }
})
