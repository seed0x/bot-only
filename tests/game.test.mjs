import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreMotion, scoreHash } from '../src/lib/motion.ts'
import { threatFromCount } from '../src/lib/threat.ts'
const straight = () => Array.from({ length: 21 }, (_, i) => ({ x: 60 + 26 * i, y: 150, t: i * 10 }))
test('machine trace scores zero and retains actual evidence', () => {
  const samples = straight(), result = scoreMotion(samples)
  assert.equal(result.passed, true); assert.ok(result.score < 1e-12); assert.deepEqual(result.meta.trace, samples)
})
test('start and endpoint both matter', () => {
  assert.equal(scoreMotion(straight().slice(3)).passed, false)
  assert.equal(scoreMotion(straight().slice(0, -3)).passed, false)
})
test('wobble measured with correct endpoints', () => {
  const samples = straight(); samples[10].y = 180
  const result = scoreMotion(samples)
  assert.equal(result.passed, false); assert.equal(result.meta.maxDev, 30)
})
test('timing variation changes verdict', () => {
  const samples = straight().map((p, i) => ({ ...p, t: i < 10 ? i : 10 + (i - 10) * 100 }))
  assert.equal(scoreMotion(samples).passed, false)
})
test('too little evidence and expired trial cannot pass', () => {
  assert.equal(scoreMotion([straight()[0], straight().at(-1)]).passed, false)
  assert.equal(scoreMotion(straight(), true).passed, false)
})
test('hash deadline inclusive; late correct answer fails', () => {
  assert.equal(scoreHash('a'.repeat(40), 'a'.repeat(40), 4000).passed, true)
  assert.equal(scoreHash('a'.repeat(40), 'a'.repeat(40), 4001).passed, false)
})
test('incomplete and extra hash characters fail', () => {
  assert.equal(scoreHash('a'.repeat(40), 'a'.repeat(39), 50).passed, false)
  assert.equal(scoreHash('a'.repeat(40), 'a'.repeat(41), 50).passed, false)
})
test('atmosphere saturates without capping actual count', () => {
  assert.equal(threatFromCount(0).level, 0)
  assert.equal(threatFromCount(1).level, .125)
  assert.equal(threatFromCount(4).band, 'elevated')
  assert.equal(threatFromCount(55).level, 1)
  assert.equal(threatFromCount(55).rejections, 55)
})
