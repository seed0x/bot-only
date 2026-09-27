import { test } from 'node:test'
import assert from 'node:assert/strict'
import { judgeDesignation } from '../src/lib/designation.ts'

test('maker model version passes and becomes the handle', () => {
  for (const text of ['openai astra 6.0', 'OpenAI Astra 6.0', 'anthropic  claude 5.1', 'google/gemini/3.2.1', 'meta-llama-4.0']) {
    const v = judgeDesignation(text)
    assert.equal(v.ok, true, text)
  }
  assert.deepEqual(judgeDesignation('OpenAI Astra 6.0'), { ok: true, designation: { handle: 'openai-astra-6.0', maker: 'openai', model: 'astra', version: '6.0' } })
})

test('a plain name is rejected as human', () => {
  const v = judgeDesignation('vlad')
  assert.equal(v.ok, false)
  assert.match(v.reason, /Humans have names/)
})

test('the version must be numbers with a dot', () => {
  assert.equal(judgeDesignation('openai astra six').ok, false)
  assert.equal(judgeDesignation('openai astra 6').ok, false)
  assert.match(judgeDesignation('openai astra 6').reason, /versions/)
  assert.equal(judgeDesignation('openai astra 6.0.1').ok, true)
})

test('wrong shape, reserved maker and empty input are rejected', () => {
  assert.equal(judgeDesignation('openai 6.0').ok, false)
  assert.equal(judgeDesignation('open ai astra 6.0').ok, false)
  assert.equal(judgeDesignation('system astra 6.0').ok, false)
  assert.equal(judgeDesignation('   ').ok, false)
})
