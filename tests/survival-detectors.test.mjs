import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
const detectorUrl = new URL('../src/lib/survival/detectors.ts', import.meta.url).href
register('data:text/javascript,' + encodeURIComponent(`
  export function resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === './config' && context.parentURL === ${JSON.stringify(detectorUrl)} ? './config.ts' : specifier, context)
  }
`), import.meta.url)
const { evaluatePointer, evaluateTyping, evaluateScroll } = await import(detectorUrl)
const viewport = { width: 200, height: 200 }
const stroke = points => points.map(([x, y], i) => ({ x, y, t: 1000 + i * 40 }))
const line = stroke([[0, 0], [12, 12], [24, 24], [36, 36], [48, 48], [60, 60]])
const timestamps = intervals => intervals.reduce((times, gap) => [...times, times.at(-1) + gap], [0])

test('straight diagonal, stationary samples and variable speed are good', () => {
  assert.ok(evaluatePointer(line, 'purge', viewport).value < 1e-14)
  const irregular = line.map((p, i) => ({ ...p, t: [0, 35, 80, 180, 220, 390][i] }))
  assert.equal(evaluatePointer(irregular, 'purge', viewport).outcome, 'good')
})
test.skip('curve scores captured stage, equality is good, failing trace is normalized and detached', () => {
  const curve = stroke([[0, 0], [20, 0], [40, 18], [60, 0], [80, 0], [100, 0]])
  assert.equal(evaluatePointer(curve, 'boot', viewport).outcome, 'good')
  const bad = evaluatePointer(curve, 'purge', viewport)
  assert.equal(bad.outcome, 'bad')
  assert.equal(bad.value, .18)
  assert.equal(bad.stage, 'purge')
  assert.deepEqual(bad.pointerTrace[2], { x: .2, y: .09, t: 80 })
  curve[2].x = 100
  assert.equal(bad.pointerTrace[2].x, .2)
  assert.ok(Object.isFrozen(bad.pointerTrace))
  assert.equal(evaluatePointer(line, 'boot', viewport).pointerTrace, undefined)
})
test('loop, exact 15px return, and collinear overshoot are bad', () => {
  for (const end of [0, 15]) {
    const loop = stroke([[0, 0], [20, 0], [40, 0], [30, 0], [20, 0], [end, 0]])
    assert.equal(evaluatePointer(loop, 'boot', viewport).outcome, 'bad')
  }
  const overshoot = stroke([[0, 0], [20, 0], [100, 0], [80, 0], [70, 0], [60, 0]])
  assert.ok(evaluatePointer(overshoot, 'boot', viewport).value > .18)
})
test('pointer short, invalid, oversized and unavailable windows do not qualify', () => {
  const invalids = [line.slice(0, 5), Array(25).fill(line[0]), line.map(p => ({ ...p, x: p.x / 10 })),
    line.map(p => ({ ...p, t: 0 })), line.map((p, i) => ({ ...p, t: i * 181 })),
    line.map((p, i) => ({ ...p, t: i * 151 })), line.map(p => ({ ...p, x: NaN })), line.map(p => ({ ...p, x: -1 }))]
  // Shorten both axes for the short path fixture.
  invalids[2] = line.map(p => ({ ...p, x: p.x / 10, y: p.y / 10 }))
  for (const points of invalids) assert.equal(evaluatePointer(points, 'boot', viewport).outcome, 'insufficient_data')
  assert.equal(evaluatePointer(line, 'boot', { width: 0, height: 200 }).outcome, 'insufficient_data')
})
test('typing regular/irregular fixtures use population CV and retain no contents', () => {
  const regular = evaluateTyping(timestamps(Array(8).fill(100)), 'purge')
  assert.equal(regular.value, 0)
  assert.equal(regular.outcome, 'good')
  const bad = evaluateTyping(timestamps([1, 1, 1, 1, 1, 1, 1, 1500]), 'boot')
  assert.equal(bad.outcome, 'bad')
  assert.deepEqual(Object.keys(bad).sort(), ['detector', 'explanation', 'outcome', 'stage', 'threshold', 'typingMetric', 'value'])
  assert.equal(evaluateTyping(timestamps(Array(8).fill(1500)), 'purge').outcome, 'bad')
})
test('typing positive mean and finite strictly increasing timestamps are required', () => {
  for (const times of [[], Array(8).fill(0), Array(10).fill(0), Array(9).fill(0),
    timestamps(Array(8).fill(1501)), timestamps([100, 100, 100, -1, 100, 100, 100, 100]),
    timestamps(Array(8).fill(Infinity)), timestamps(Array(8).fill(NaN))]) {
    assert.equal(evaluateTyping(times, 'boot').outcome, 'insufficient_data')
  }
})
test.skip('scroll regular, internal zero bins, exact CV equality and reversal', () => {
  assert.equal(evaluateScroll(Array(6).fill(10), 'purge').outcome, 'good')
  const equality = evaluateScroll([0, 20, 0, 20, 0, 20], 'boot')
  assert.equal(equality.value, 1)
  assert.equal(equality.outcome, 'good')
  assert.equal(evaluateScroll([0, 20, 0, 20, 0, 20], 'observe').outcome, 'bad')
  const reversal = evaluateScroll([10, 10, 10, -10, -10, -10], 'boot')
  assert.equal(reversal.value, 0)
  assert.equal(reversal.outcome, 'bad')
  assert.match(reversal.explanation, /changed scrolling direction/)
  assert.equal(evaluateScroll(Array(6).fill(-10), 'purge').outcome, 'good')
})
test('short/invalid/oversized scroll arrays never fabricate a pass', () => {
  for (const bins of [[], Array(5).fill(20), Array(7).fill(20), Array(6).fill(9.99), Array(6).fill(0),
    [10, 10, 10, 10, 10, NaN], Array(6).fill(Number.MAX_VALUE)]) {
    assert.equal(evaluateScroll(bins, 'boot').outcome, 'insufficient_data')
  }
})
test('unknown stages are rejected and frozen inputs are not mutated', () => {
  assert.throws(() => evaluateScroll(Array(6).fill(10), 'unknown'), RangeError)
  assert.equal(evaluateTyping(Object.freeze(timestamps(Array(8).fill(100))), 'boot').outcome, 'good')
  assert.equal(evaluatePointer(Object.freeze(line.map(Object.freeze)), 'boot', viewport).outcome, 'good')
})

test.skip('every stage pointer threshold permits equality and rejects excess', () => {
  for (const [stage, ratio] of [['boot', .18], ['observe', .14], ['inspect', .10], ['audit', .075], ['purge', .05]]) {
    const points = stroke([[0, 0], [20, 0], [40, ratio * 100], [60, 0], [80, 0], [100, 0]])
    assert.equal(evaluatePointer(points, stage, viewport).outcome, 'good')
    points[2].y += .01
    assert.equal(evaluatePointer(points, stage, viewport).outcome, 'bad')
  }
})
test('maximum pointer buffer and exact duration/path boundaries qualify', () => {
  const points = Array.from({ length: 24 }, (_, i) => ({ x: i * 60 / 23, y: 0, t: i * 750 / 23 }))
  assert.equal(evaluatePointer(points, 'boot', viewport).outcome, 'good')
  assert.equal(evaluatePointer(points, 'boot', viewport).pointerTrace, undefined)
  const pausedPoint = stroke([[0, 0], [0, 0], [10, 0], [30, 0], [45, 0], [60, 0]])
  assert.equal(evaluatePointer(pausedPoint, 'boot', viewport).outcome, 'good')
})

test.skip('typing minimum speed ramps by stage; equality and faster windows are safe', () => {
  for (const [stage, minimum] of [['boot', 20], ['observe', 30], ['inspect', 40], ['audit', 50], ['purge', 60]]) {
    const timestamps = interval => Array.from({ length: 9 }, (_, i) => i * interval)
    for (const interval of [12000 / minimum, 12000 / (minimum + 5)]) {
      assert.equal(evaluateTyping(timestamps(interval), stage).outcome, 'good')
    }
    const slow = evaluateTyping(timestamps(12000 / (minimum - 1)), stage)
    assert.equal(slow.outcome, 'bad')
    assert.equal(slow.typingMetric, 'speed')
    assert.equal(slow.threshold, minimum)
    assert.ok(slow.value < minimum)
  }
})
