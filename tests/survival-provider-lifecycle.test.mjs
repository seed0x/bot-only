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
const jsxUrl = 'data:text/javascript,' + encodeURIComponent('export const jsx = (type, props) => ({type, props}); export const jsxs = jsx;')
const navUrl = 'data:text/javascript,' + encodeURIComponent("export const usePathname = () => '/feed';")
const childUrl = 'data:text/javascript,' + encodeURIComponent('export default function Child() { return null; }')
const root = new URL('../src/lib/survival/', import.meta.url).href
register('data:text/javascript,' + encodeURIComponent(`
export function resolve(specifier, context, nextResolve) {
  const mocks = ${JSON.stringify({ react: hookUrl, 'react/jsx-runtime': jsxUrl, 'next/navigation': navUrl, './GameHud': childUrl, './GameOver': childUrl })};
  if (context.parentURL === ${JSON.stringify(providerUrl)}) {
    if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true };
    if (specifier.startsWith('@/lib/survival/')) return { url: ${JSON.stringify(root)} + specifier.split('/').at(-1) + '.ts', shortCircuit: true };
  }
  if (context.parentURL?.startsWith(${JSON.stringify(root)}) && ['./config', './detectors'].includes(specifier)) specifier += '.ts';
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
  const originals = Object.fromEntries(['window', 'document', 'performance', 'sessionStorage', 'clearInterval'].map(key => [key, globalThis[key]]))
  globalThis.__survivalHost = { effects: [], updates: [] }
  let stored = checkpoint
  Object.assign(globalThis, { document, window, performance: { now: () => now },
    sessionStorage: { getItem: () => stored, setItem: (_key, value) => { stored = value }, removeItem: () => { stored = null } },
    clearInterval: timer => timers.delete(timer) })
  const tree = GameProvider({ children: null })
  const value = tree.props.value
  const [setup, route] = globalThis.__survivalHost.effects
  return { document, window, timers, value, setup, route,
    tick: time => { now = time; [...timers.values()].forEach(fn => fn()) },
    updates: globalThis.__survivalHost.updates,
    restore: () => { Object.assign(globalThis, originals); delete globalThis.__survivalHost } }
}

test('provider Strict Mode effect replay leaves one timer/listener set and preserves the run', () => {
  const h = host()
  let cleanup
  try {
    cleanup = h.setup(); h.route()
    const documentCount = h.document.count(), windowCount = h.window.count()
    assert.ok(documentCount > 0); assert.equal(windowCount, 4); assert.equal(h.timers.size, 1)
    h.value.start('pointer'); h.tick(3000); h.tick(3100)
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
