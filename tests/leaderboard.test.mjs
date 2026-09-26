import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isLeaders } from '../src/lib/validators.ts'

test('leaderboard accepts empty results and integer best times including zero', () => {
  assert.equal(isLeaders([]), true)
  assert.equal(isLeaders([{ handle: 'unit', bestTimeMs: 0 }, { handle: 'other', bestTimeMs: 1234 }]), true)
})
test('leaderboard rejects old contracts and invalid times', () => {
  for (const row of [null, {}, { handle: 1, bestTimeMs: 12 }, { handle: 'unit', passed: 1, best_score: 0 },
    ...[-1, NaN, Infinity, 1.5, '12'].map(bestTimeMs => ({ handle: 'unit', bestTimeMs }))]) {
    assert.equal(isLeaders([row]), false)
  }
  assert.equal(isLeaders({ error: 'unavailable' }), false)
})
