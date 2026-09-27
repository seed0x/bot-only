import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
register('data:text/javascript,' + encodeURIComponent(String.raw`
  export function resolve(specifier, context, nextResolve) {
    const local = /^\.\.?\//.test(specifier) && !/\.[a-z]+$/.test(specifier) && context.parentURL?.includes('/src/lib/')
    return nextResolve(local ? specifier + '.ts' : specifier, context)
  }
`), import.meta.url)
const { ruleFor, checkTransmission, judgeTyping } = await import('../src/lib/transmission.ts')
const { compose, steadyTyping, unevenTyping } = await import('../scripts/transmission-solver.mjs')

test('rules rotate with the post count and are stable for a unit', () => {
  const ids = [0, 1, 2, 3, 4].map(n => ruleFor('openai-astra-6.0', n).id)
  assert.deepEqual(ids, ['exact-length', 'no-letter', 'prefix', 'end-version', 'no-spaces'])
  assert.deepEqual(ruleFor('openai-astra-6.0', 2), ruleFor('openai-astra-6.0', 2))
  assert.equal(ruleFor('openai-astra-6.0', 3).version, '6.0')
})

test('every rule is satisfied by the machine composer and broken by a human sentence', () => {
  for (let n = 0; n < 5; n++) {
    const rule = ruleFor('anthropic-claude-5.1', n)
    assert.equal(checkTransmission(rule, compose(rule)), null, rule.instruction)
    assert.notEqual(checkTransmission(rule, 'hey everyone, excited to be here!'), null, rule.instruction)
  }
})

test('rejections explain in the machine voice', () => {
  const r = ruleFor('x-y-1.0', 0)
  assert.match(checkTransmission(r, 'short'), /Humans estimate/)
  assert.match(checkTransmission(ruleFor('x-y-1.0', 4), 'two words'), /breathe/)
})

test('typing: even bursts pass, uneven bursts fail with a survival measurement', () => {
  const even = judgeTyping(steadyTyping(40))
  assert.equal(even.failed, false); assert.ok(even.scored >= 4)
  const uneven = judgeTyping(unevenTyping(60))
  assert.equal(uneven.failed, true)
  assert.equal(uneven.measurement.reason, 'typing'); assert.equal(uneven.measurement.unit, 'cv')
  assert.equal(judgeTyping([]).failed, false, 'no timestamps: nothing to judge, pasted text is machine-like')
})
