import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isResults } from '../src/lib/results.ts'
const receipt = { attemptId: 1, handle: 'unit', passed: true, recordedAt: '2026-09-26 12:00:00', result: { challenge: 'image-confusion', passed: true, score: 0.02, duration_ms: 1200, meta: { reason: 'Recorded result.' } } }
test('results accept confirmed empty, pass and fail responses', () => {
  assert.equal(isResults([]), true)
  assert.equal(isResults([receipt]), true)
  assert.equal(isResults([{ ...receipt, passed: false, result: { ...receipt.result, passed: false } }]), true)
})
test('inconsistent verdicts, invalid metrics and non-image results cannot reach result cards', () => {
  for (const result of [
    { ...receipt.result, passed: false }, { ...receipt.result, score: NaN },
    { ...receipt.result, score: 2 }, { ...receipt.result, duration_ms: -1 },
    { ...receipt.result, challenge: 'straight-line' }, { ...receipt.result, meta: null },
  ]) assert.equal(isResults([{ ...receipt, result }]), false)
  assert.equal(isResults({ error: 'unavailable' }), false)
  assert.equal(isResults([null]), false)
})
