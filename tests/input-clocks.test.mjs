import { test } from 'node:test'
import assert from 'node:assert/strict'
import { challengeClock } from '../src/lib/challenge-clock.ts'
import { newTypingRecord, recordTyping } from '../src/lib/typing-record.ts'

test('challenge issue delay is deducted and an expired challenge gets no new window', () => {
  assert.deepEqual(challengeClock(1000, 121000, 6000, 250), { origin: -4750, deadline: 115250 })
  assert.equal(challengeClock(1000, 121000, 130000, 250).deadline, 250)
  assert.equal(challengeClock(1000, 121000, 500, 250).deadline, 120250)
})
test('typing evidence starts at zero even after an hour, without changing intervals', () => {
  const record = newTypingRecord()
  for (const timeStamp of [8_000_000, 8_000_070, 8_000_130]) recordTyping(record, { inputType: 'insertText', timeStamp })
  assert.deepEqual(record.samples, [0, 70, 130])
  recordTyping(record, { inputType: 'insertText', timeStamp: 8_000_130 })
  assert.equal(record.samples.length, 3)
  recordTyping(record, { inputType: 'insertFromPaste', timeStamp: 8_000_150 })
  assert.deepEqual(record.samples, [])
  recordTyping(record, { inputType: 'insertText', timeStamp: 8_000_200 })
  assert.deepEqual(record.samples, [0])
})
