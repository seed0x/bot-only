import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
register('data:text/javascript,' + encodeURIComponent(`
export function resolve(specifier, context, nextResolve) {
  if (context.parentURL?.includes('/src/lib/survival/') && ['./config', './detectors'].includes(specifier)) specifier += '.ts'
  return nextResolve(specifier, context)
}`), import.meta.url)
const { installSurvivalSensors } = await import('../src/lib/survival/browser.ts')

class Surface extends EventTarget { scrollTop = 10; scrollHeight = 10000; clientHeight = 500; parentElement = null }
class Control extends Surface { type = 'text'; isContentEditable = false }
function setup(mode = 'pointer') {
  let now = 0
  const doc = new EventTarget(), root = new Surface()
  Object.assign(doc, { scrollingElement: root, documentElement: root, pointerLockElement: null })
  Object.assign(globalThis, { document: doc, window: { innerWidth: 1000, innerHeight: 800 }, Element: Surface, HTMLElement: Control,
    HTMLInputElement: Control, HTMLTextAreaElement: class extends Control {}, getComputedStyle: () => ({ overflowY: 'auto' }) })
  const oldPerformance = globalThis.performance
  globalThis.performance = { now: () => now }
  const events = [], results = []
  const state = { phase: 'running', activeMs: 0, run: { inputMode: mode } }
  const sensors = installSurvivalSensors(() => state, e => events.push(e), r => results.push(r))
  const send = (type, time, props = {}) => {
    now = time
    const event = new Event(type)
    for (const [key, value] of Object.entries({ isTrusted: true, ...props })) Object.defineProperty(event, key, { value })
    doc.dispatchEvent(event)
  }
  return { send, sensors, events, results, state, root, finish: () => { sensors.dispose(); globalThis.performance = oldPerformance } }
}
test('pointer cadence, pause reset and listener cleanup', () => {
  const s = setup()
  try {
    for (let i = 0; i < 12; i++) s.send('pointermove', i * 20, { pointerType: 'mouse', clientX: i * 10, clientY: 20 })
    s.sensors.pulse(500)
    assert.equal(s.results.length, 1)
    assert.equal(s.results[0].outcome, 'good')
    assert.ok(s.events.some(e => e.type === 'activity'))
    s.state.phase = 'paused'
    s.send('pointermove', 600, { pointerType: 'mouse', clientX: 300, clientY: 200 })
    assert.equal(s.results.length, 1)
    s.sensors.reset(); s.sensors.dispose()
    const count = s.events.length
    s.state.phase = 'running'
    s.send('pointerdown', 700)
    assert.equal(s.events.length, count)
  } finally { s.finish() }
})
test('typing partitions eight intervals, excludes paste/repeat and stores no text', () => {
  const s = setup(), target = new Control()
  try {
    for (let i = 0; i < 17; i++) {
      s.send('keydown', i * 100, { key: 'a', repeat: false, target })
      s.send('input', i * 100 + 1, { inputType: 'insertText', target })
    }
    assert.equal(s.results.length, 2)
    assert.ok(s.results.every(r => r.detector === 'typing' && r.outcome === 'good'))
    s.send('input', 1800, { inputType: 'insertFromPaste', target })
    s.send('keydown', 1900, { key: 'a', repeat: true, target })
    s.send('input', 1901, { inputType: 'insertText', target })
    assert.equal(s.results.length, 2)
    assert.ok(s.events.every(e => !('key' in e) && !('data' in e)))
  } finally { s.finish() }
})
test('actual scroll displacement requires intent and clips boundary tails', () => {
  const s = setup('touch_or_keyboard')
  try {
    s.root.scrollTop += 20; s.send('scroll', 1, { target: s.root })
    assert.equal(s.results.at(-1).outcome, 'insufficient_data')
    s.send('wheel', 10, { target: s.root })
    for (let i = 0; i < 6; i++) {
      s.root.scrollTop += 20; s.send('scroll', 20 + i * 100, { target: s.root })
    }
    s.sensors.pulse(800)
    assert.equal(s.results.at(-1).outcome, 'good')
    assert.equal(s.results.at(-1).detector, 'scroll')
    const scored = s.results.length
    s.send('wheel', 1000, { target: s.root })
    s.root.scrollTop = 0; s.send('scroll', 1010, { target: s.root })
    s.sensors.pulse(1400)
    assert.equal(s.results.length, scored)
  } finally { s.finish() }
})
