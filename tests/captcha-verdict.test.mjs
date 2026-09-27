import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
// Source files import each other without extensions (bundler resolution); give Node a resolver that
// appends .ts for those relative imports, the same way the survival tests do.
register('data:text/javascript,' + encodeURIComponent(String.raw`
  export function resolve(specifier, context, nextResolve) {
    const local = /^\.\.?\//.test(specifier) && !/\.[a-z]+$/.test(specifier) && context.parentURL?.includes('/src/lib/')
    return nextResolve(local ? specifier + '.ts' : specifier, context)
  }
`), import.meta.url)
const { judgeCaptcha, CAPTCHA_STAGE, CAPTCHA_IDLE_MS } = await import('../src/lib/captcha-verdict.ts')
const { collected, interrupt, newPointerCollector, observe } = await import('../src/lib/survival/pointer-collector.ts')
const { RULES } = await import('../src/lib/image-captcha.ts')

const viewport = { width: 1280, height: 800 }
const tile = (id, category) => ({ token: id, file: `${category}/01.webp`, category })
const round = { rule: 'pair', requested: 'crosswalk', prompt: 'crosswalks', instruction: RULES.pair.instruction, ordered: false,
  tiles: [tile('cw', 'crosswalk'), tile('tt', 'train-track'), tile('bk', 'bicycle')] }
const steady = ids => ids.map((id, i) => ({ id, t: 200 + i * 150 }))
const straight = (k = 0) => Array.from({ length: 8 }, (_, i) => ({ x: 100 + i * 40, y: 100 + k * 50, t: 60 + k * 200 + i * 16 }))
const curved = (k = 0) => Array.from({ length: 12 }, (_, i) => ({ x: 300 + i * 25, y: 300 + Math.sin(i / 1.5) * 120, t: 60 + k * 200 + i * 16 }))
const base = { round, clicks: steady(['cw', 'tt']), viewport, elapsedMs: 900, windowMs: 30_000, expired: false }

test('right tiles, straight strokes, steady clicks: admitted with low humanity', () => {
  const v = judgeCaptcha({ ...base, strokes: [straight(0), straight(1)] })
  assert.equal(v.passed, true)
  assert.equal(v.measurements.length, 0)
  assert.ok(v.humanity <= 0.2)
  assert.equal(v.pointer.bad, 0)
})

test('three curved strokes fail on the pointer detector with a boot-stage measurement', () => {
  const v = judgeCaptcha({ ...base, strokes: [curved(0), curved(1), curved(2)] })
  assert.equal(v.passed, false)
  assert.equal(v.primaryReason, 'pointer')
  const m = v.measurements[0]
  assert.equal(m.stage, 'boot'); assert.equal(m.unit, 'ratio'); assert.equal(m.threshold, CAPTCHA_STAGE.pointerRatio)
  assert.ok(m.value > m.threshold)
  assert.ok(v.pointer.worstTrace, 'keeps the failing trace as evidence')
})

test('two curved strokes are a warning, not a failure, at boot', () => {
  const v = judgeCaptcha({ ...base, strokes: [curved(0), curved(1)] })
  assert.equal(v.passed, true)
  assert.equal(v.pointer.bad, 2)
})

test('a pause at the idle limit fails as idle', () => {
  const v = judgeCaptcha({ ...base, strokes: [], clicks: [{ id: 'cw', t: 200 }, { id: 'tt', t: 200 + CAPTCHA_IDLE_MS }] })
  assert.equal(v.passed, false)
  assert.equal(v.primaryReason, 'idle')
  assert.equal(v.measurements[0].unit, 'ms')
})

test('wrong tiles outrank a pointer failure in the precedence order', () => {
  const v = judgeCaptcha({ ...base, clicks: steady(['bk']), strokes: [curved(0), curved(1), curved(2)] })
  assert.equal(v.primaryReason, 'verification_failed')
  assert.deepEqual(v.measurements.map(m => m.reason), ['verification_failed', 'pointer'])
})

test('changing the selection twice fails; once is allowed', () => {
  const once = judgeCaptcha({ ...base, strokes: [], clicks: [...steady(['cw', 'bk']), { id: 'bk', t: 600 }, { id: 'tt', t: 750 }] })
  assert.equal(once.passed, true)
  const twice = judgeCaptcha({ ...base, strokes: [], clicks: [...steady(['cw', 'bk']), { id: 'bk', t: 600 }, { id: 'bk', t: 700 }, { id: 'bk', t: 800 }, { id: 'tt', t: 900 }] })
  assert.equal(twice.passed, false)
  assert.match(twice.reason, /Changed the selection 2 times/)
})

test('no viewport means no pointer verdict: touch players are judged on tiles and timing only', () => {
  const v = judgeCaptcha({ ...base, viewport: null, strokes: [curved(0), curved(1), curved(2)] })
  assert.equal(v.passed, true)
  assert.equal(v.pointer.scored, 0)
})

test('collector: rate cap, gap split, 750ms window split sharing the endpoint, interrupts', () => {
  const c = newPointerCollector()
  for (let i = 0; i < 10; i++) observe(c, { x: i * 10, y: 0, t: i * 40 })      // 40ms apart: kept
  observe(c, { x: 100, y: 0, t: 361 + 5 })                                       // 5ms after the last: dropped (30 Hz cap)
  assert.equal(c.current.length, 10)
  observe(c, { x: 200, y: 0, t: 361 + 500 })                                     // >180ms gap: stroke closes, new one starts
  assert.equal(c.strokes.length, 1); assert.equal(c.current.length, 1)
  const start = 361 + 500
  for (let i = 1; i < 30; i++) observe(c, { x: 200 + i, y: 0, t: start + i * 40 })  // 40ms apart; the 750ms window splits at i = 19
  assert.equal(c.strokes.length, 2)
  assert.equal(c.strokes[1].length, 19)
  assert.deepEqual(c.current[0], c.strokes[1].at(-1), 'the next stroke starts from the shared endpoint')
  assert.equal(c.current.length, 12)
  interrupt(c)
  assert.equal(c.current.length, 0)
  assert.equal(collected(c).length, 3)
  const short = newPointerCollector()
  for (let i = 0; i < 3; i++) observe(short, { x: i, y: 0, t: i * 40 })
  assert.equal(collected(short).length, 0, 'fewer than 6 samples never qualifies')
})

test('the gap after the last click is judged through verification', () => {
  const last = base.clicks.at(-1).t
  const before = judgeCaptcha({ ...base, strokes: [], elapsedMs: last + CAPTCHA_IDLE_MS - 1 })
  assert.equal(before.passed, true)
  const atLimit = judgeCaptcha({ ...base, strokes: [], elapsedMs: last + CAPTCHA_IDLE_MS })
  assert.equal(atLimit.primaryReason, 'idle')
  assert.equal(atLimit.maxGap, CAPTCHA_IDLE_MS)
})

test('one tile error passes the full verdict; two errors still fail', () => {
  assert.equal(judgeCaptcha({ ...base, strokes: [], clicks: steady(['cw']) }).passed, true)
  assert.equal(judgeCaptcha({ ...base, strokes: [], clicks: steady(['cw', 'tt', 'bk']) }).passed, true)
  assert.equal(judgeCaptcha({ ...base, strokes: [], clicks: steady(['cw', 'bk']) }).primaryReason, 'verification_failed')
})
