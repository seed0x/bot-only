import { test } from 'node:test'
import assert from 'node:assert/strict'
import { answerFor, clickRhythm, createImageRound, IMAGE_CATEGORIES, MAX_GAP_MS, RULES, scoreImageRound } from '../src/lib/image-captcha.ts'

let seed = 42
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32)
let n = 0
const token = () => `tok${String(n++).padStart(13, '0')}`
const steady = ids => ids.map((id, i) => ({ id, t: 200 + i * 150 }))
const tile = (id, category) => ({ token: id, file: `${category}/01.webp`, category })

// crosswalk ↔ train-track; bicycle is a decoy
const base = { requested: 'crosswalk', prompt: 'crosswalks', tiles: [tile('cw', 'crosswalk'), tile('tt', 'train-track'), tile('bk', 'bicycle'), tile('cw2', 'crosswalk')] }
const round = rule => ({ ...base, rule, instruction: RULES[rule].instruction, ordered: RULES[rule].ordered })

test('pair: the requested category and its look-alike, nothing else', () => {
  const r = round('pair')
  assert.deepEqual(answerFor(r), ['cw', 'tt', 'cw2'])
  assert.equal(scoreImageRound(r, steady(['cw', 'tt', 'cw2'])).passed, true)
  const human = scoreImageRound(r, steady(['cw', 'cw2']))
  assert.equal(human.passed, false)
  assert.match(human.reason, /left out the train tracks/)
  assert.equal(scoreImageRound(r, steady(['cw', 'tt', 'cw2', 'bk'])).passed, false)
})

test('except: everything but the requested category, look-alikes included', () => {
  const r = round('except')
  assert.deepEqual(answerFor(r), ['tt', 'bk'])
  assert.equal(scoreImageRound(r, steady(['tt', 'bk'])).passed, true)
  const human = scoreImageRound(r, steady(['bk']))
  assert.equal(human.passed, false)
  assert.match(human.reason, /also skipped the train tracks/)
})

test('in-order: right tiles in the wrong order fail', () => {
  const r = round('in-order')
  assert.equal(scoreImageRound(r, steady(['cw', 'tt', 'cw2'])).passed, true)
  const human = scoreImageRound(r, steady(['cw2', 'tt', 'cw']))
  assert.equal(human.passed, false)
  assert.match(human.reason, /wrong order/)
})

test('rhythm: toggles replay into the final selection and count as corrections', () => {
  const clicks = [{ id: 'a', t: 0 }, { id: 'b', t: 100 }, { id: 'a', t: 200 }, { id: 'a', t: 300 }]
  const r = clickRhythm(clicks)
  assert.deepEqual(r.selection, ['b', 'a'])
  assert.equal(r.corrections, 1)
  assert.equal(r.maxGap, 100)
  assert.equal(r.cv, 0)
})

test('rhythm: one correction is allowed, two fail; a long pause fails', () => {
  const r = round('pair')
  const once = [...steady(['cw', 'bk']), { id: 'bk', t: 600 }, { id: 'tt', t: 750 }, { id: 'cw2', t: 900 }]
  assert.equal(scoreImageRound(r, once).passed, true)
  const twice = [...once.slice(0, 3), { id: 'bk', t: 700 }, { id: 'bk', t: 800 }, { id: 'tt', t: 900 }, { id: 'cw2', t: 1000 }]
  const mind = scoreImageRound(r, twice)
  assert.equal(mind.passed, false)
  assert.match(mind.reason, /Changed your mind 2 times/)
  const slow = [{ id: 'cw', t: 0 }, { id: 'tt', t: 100 }, { id: 'cw2', t: 100 + MAX_GAP_MS + 1 }]
  const paused = scoreImageRound(r, slow)
  assert.equal(paused.passed, false)
  assert.match(paused.reason, /Paused/)
})

test('rhythm: an even cadence reads as more machine than an uneven one', () => {
  const r = round('pair')
  const even = scoreImageRound(r, steady(['cw', 'tt', 'cw2']))
  const uneven = scoreImageRound(r, [{ id: 'cw', t: 0 }, { id: 'tt', t: 100 }, { id: 'cw2', t: 2400 }])
  assert.equal(uneven.passed, true)
  assert.ok(even.humanity < uneven.humanity)
})

test('generated rounds: nine unique opaque tiles, every rule and category, a nonempty answer', () => {
  const rules = new Set(), categories = new Set()
  for (let i = 0; i < 600; i++) {
    const r = createImageRound(random, token)
    rules.add(r.rule); categories.add(r.requested)
    assert.equal(r.tiles.length, 9)
    assert.equal(new Set(r.tiles.map(t => t.token)).size, 9)
    assert.equal(new Set(r.tiles.map(t => t.file)).size, 9)
    const opposite = IMAGE_CATEGORIES[r.requested].opposite
    assert.ok(r.tiles.some(t => t.category === opposite), 'always shows a look-alike')
    if (r.rule === 'except') assert.ok(r.tiles.some(t => t.category === r.requested), 'except shows something to leave out')
    const answer = answerFor(r)
    assert.ok(answer.length > 0 && answer.length < 9)
    assert.equal(scoreImageRound(r, steady(answer)).passed, true, 'a literal machine always passes')
  }
  assert.equal(rules.size, 3)
  assert.equal(categories.size, 6)
})
