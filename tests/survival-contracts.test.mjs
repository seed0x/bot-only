import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SURVIVAL_STAGES, survivalStageAt, SURVIVAL_FAILURE_PRECEDENCE,
  SURVIVAL_SENSORS, SURVIVAL_LIMITS, SURVIVAL_TIMING } from '../src/lib/survival/config.ts'

test('stages cover exact and fractional boundaries without gaps', () => {
  assert.equal(survivalStageAt(0).id, 'boot')
  for (let i = 1; i < SURVIVAL_STAGES.length; i++) {
    const boundary = SURVIVAL_STAGES[i].startsAtMs
    assert.equal(survivalStageAt(boundary - .001).id, SURVIVAL_STAGES[i - 1].id)
    assert.equal(survivalStageAt(boundary).id, SURVIVAL_STAGES[i].id)
    assert.equal(survivalStageAt(boundary + .001).id, SURVIVAL_STAGES[i].id)
  }
  assert.equal(survivalStageAt(Number.MAX_VALUE).id, 'purge')
  for (const invalid of [-.001, NaN, Infinity, -Infinity]) {
    assert.throws(() => survivalStageAt(invalid), RangeError)
  }
})
test.skip('all five defaults tighten monotonically and are immutable', () => {
  assert.deepEqual(SURVIVAL_STAGES.map(s => [s.id, s.startsAtMs, s.idleLimitMs, s.pointerRatio, s.typingCv, s.scrollCv, s.objectiveBudgetMs, s.badWindowsToFail]), [
    ['boot', 0, 12000, .18, .90, 1, 35000, 3],
    ['observe', 30000, 10000, .14, .70, .80, 30000, 3],
    ['inspect', 60000, 8000, .10, .55, .60, 25000, 2],
    ['audit', 90000, 6000, .075, .40, .45, 20000, 2],
    ['purge', 120000, 4000, .05, .30, .35, 15000, 1],
  ])
  assert.ok(Object.isFrozen(SURVIVAL_STAGES))
  for (const stage of SURVIVAL_STAGES) assert.ok(Object.isFrozen(stage))
})
test('first-failure ordering covers each cause once', () => {
  assert.deepEqual(SURVIVAL_FAILURE_PRECEDENCE, ['verification_failed', 'objective_deadline', 'idle', 'pointer', 'typing', 'scroll'])
  assert.ok(Object.isFrozen(SURVIVAL_FAILURE_PRECEDENCE))
})
test('bounded buffers can hold qualified windows and compact evidence', () => {
  assert.equal(SURVIVAL_SENSORS.typingMaxTimestamps, SURVIVAL_SENSORS.typingIntervals + 1)
  assert.equal(SURVIVAL_SENSORS.scrollMaxBins, SURVIVAL_SENSORS.scrollWindowBins)
  assert.ok(SURVIVAL_SENSORS.pointerMaxSamples >= SURVIVAL_SENSORS.pointerMinSamples)
  assert.equal(SURVIVAL_LIMITS.pointerTraceMaxSamples, SURVIVAL_SENSORS.pointerMaxSamples)
  assert.equal(SURVIVAL_LIMITS.measurementsMax, SURVIVAL_FAILURE_PRECEDENCE.length)
  assert.ok(SURVIVAL_LIMITS.finishBodyBytes < SURVIVAL_LIMITS.requestBodyBytes)
  assert.equal(SURVIVAL_TIMING.admissionBudgetMs, 60000)
  assert.equal(SURVIVAL_TIMING.countdownMs, 3000)
  assert.ok(Object.isFrozen(SURVIVAL_LIMITS))
})
