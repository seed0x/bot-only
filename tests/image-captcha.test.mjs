import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createImageRound, scoreImageRound } from '../src/lib/image-captcha.ts'

const pairs = {
  crosswalk: 'train-track', 'train-track': 'crosswalk',
  'traffic-light': 'streetlight', streetlight: 'traffic-light',
  bicycle: 'motorcycle', motorcycle: 'bicycle',
}

for (const [requested, opposite] of Object.entries(pairs)) {
  test(`${requested}: both categories required; unrelated selections fail`, () => {
    const round = { requested, prompt: requested, tiles: [
      { id: 'requested', category: requested },
      { id: 'opposite', category: opposite },
      { id: 'decoy', category: Object.keys(pairs).find(c => c !== requested && c !== opposite) },
    ] }
    assert.equal(scoreImageRound(round, ['requested', 'opposite']).passed, true)
    for (const selected of [[], ['requested'], ['opposite'], ['requested', 'opposite', 'decoy'], ['requested', 'opposite', 'unknown']]) {
      assert.equal(scoreImageRound(round, selected).passed, false)
    }
    // Zero requested-category tiles is a valid puzzle; the look-alike is still required.
    const withoutRequested = { ...round, tiles: round.tiles.slice(1) }
    assert.equal(scoreImageRound(withoutRequested, ['opposite']).passed, true)
    assert.equal(scoreImageRound(withoutRequested, []).passed, false)
  })
}

test('generated rounds include nine unique tiles and a nonempty look-alike category', () => {
  let seed = 42
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32)
  const seen = new Set()
  let sawZeroRequested = false
  for (let i = 0; i < 300; i++) {
    const round = createImageRound(random)
    seen.add(round.requested)
    assert.equal(round.tiles.length, 9)
    assert.equal(new Set(round.tiles.map(t => t.id)).size, 9)
    const requestedCount = round.tiles.filter(t => t.category === round.requested).length
    const oppositeCount = round.tiles.filter(t => t.category === pairs[round.requested]).length
    assert.ok(requestedCount >= 0 && requestedCount <= 3)
    assert.ok(oppositeCount >= 1 && oppositeCount <= 3)
    sawZeroRequested ||= requestedCount === 0
  }
  assert.equal(seen.size, 6)
  assert.equal(sawZeroRequested, true)
})
