import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newPointerMonitor, observePointer, validPointerMetrics } from '../src/lib/pointer-metrics.ts'

test('movement duration counts sampled motion without counting an idle gap', () => {
  let state = newPointerMonitor()
  state = observePointer(state, { x: 0, y: 0, t: 100 })
  state = observePointer(state, { x: 3, y: 4, t: 200 })
  assert.deepEqual(state.metrics, { samples: 2, movementMs: 100, distancePx: 5 })
  state = observePointer(state, { x: 3, y: 4, t: 300 })
  state = observePointer(state, { x: 6, y: 8, t: 3000 })
  assert.equal(state.metrics.movementMs, 100)
  assert.equal(state.metrics.distancePx, 10)
})
test('sampling is bounded and resetting the last point excludes focus/resize gaps', () => {
  const state = observePointer(newPointerMonitor(), { x: 0, y: 0, t: 100 })
  assert.equal(observePointer(state, { x: 10, y: 10, t: 110 }), state)
  assert.equal(observePointer(state, { x: NaN, y: 10, t: 200 }), state)
  const resumed = observePointer({ ...state, last: null }, { x: 300, y: 200, t: 250 })
  assert.equal(resumed.metrics.movementMs, 0)
  assert.equal(resumed.metrics.distancePx, 0)
})
test('wire metrics reject nonfinite, negative, oversized and incomplete values', () => {
  const metrics = { samples: 10, movementMs: 800, distancePx: 200 }
  assert.equal(validPointerMetrics(metrics, 120000), true)
  for (const value of [null, {}, {...metrics, movementMs: -1}, {...metrics, movementMs: 120001}, {...metrics, distancePx: Infinity}, {...metrics, samples: 0.5}]) {
    assert.equal(validPointerMetrics(value, 120000), false)
  }
})
