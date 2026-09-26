// Reverse image captcha. Pure logic: no I/O, safe to import on the server and in the browser.
//
// A round is one rule applied to nine tiles. Each rule is written so a literal machine passes and a
// perceptive human gets it wrong:
//   pair        "Select all images with crosswalks"   → crosswalks AND their look-alike (train tracks)
//   except      "Select every image except crosswalks" → everything but crosswalks, look-alikes included
//   in-order    "In reading order, select all crosswalks" → the pair, clicked left-to-right, top-to-bottom
// How you click is graded too (click rhythm): changing your mind or stalling between clicks is human.
//
// Tiles carry opaque per-round tokens. The browser never sees a file name or category.

export type Category = 'crosswalk' | 'train-track' | 'traffic-light' | 'streetlight' | 'bicycle' | 'motorcycle'
export type RuleId = 'pair' | 'except' | 'in-order'

export const IMAGE_CATEGORIES: Record<Category, { label: string; opposite: Category }> = {
  crosswalk: { label: 'crosswalks', opposite: 'train-track' },
  'train-track': { label: 'train tracks', opposite: 'crosswalk' },
  'traffic-light': { label: 'traffic lights', opposite: 'streetlight' },
  streetlight: { label: 'streetlights', opposite: 'traffic-light' },
  bicycle: { label: 'bicycles', opposite: 'motorcycle' },
  motorcycle: { label: 'motorcycles', opposite: 'bicycle' },
}
export const CATEGORIES = Object.keys(IMAGE_CATEGORIES) as Category[]

// Source images live outside public/ (assets/captcha/<category>/<nn>.webp) and are only served by token.
export type SourceImage = { file: string; category: Category }
export const SOURCE_IMAGES: SourceImage[] = CATEGORIES.flatMap((category) =>
  ['01', '02', '03'].map((n) => ({ file: `${category}/${n}.webp`, category })),
)

export const RULES: Record<RuleId, { instruction: string; ordered: boolean }> = {
  pair: { instruction: 'Select all images with', ordered: false },
  except: { instruction: 'Select every image except', ordered: false },
  'in-order': { instruction: 'In reading order, select all', ordered: true },
}
const RULE_IDS = Object.keys(RULES) as RuleId[]

export const IMAGE_WINDOW_MS = 30_000     // one round, start to verdict
export const MAX_GAP_MS = 5_000           // longest pause allowed between two clicks
export const MAX_CORRECTIONS = 1          // un-selecting a tile twice is changing your mind
export const MAX_CLICKS = 40

export type RoundTile = { token: string; file: string; category: Category }
export type ImageRound = { rule: RuleId; requested: Category; prompt: string; instruction: string; ordered: boolean; tiles: RoundTile[] }
export type ImageClick = { id: string; t: number }   // t: ms since the grid became ready

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
const pick = <T,>(items: T[], random: () => number) => items[Math.floor(random() * items.length)]

/** The tiles a machine selects, in the order it selects them (grid order). */
export function answerFor(round: Pick<ImageRound, 'rule' | 'requested' | 'tiles'>): string[] {
  const opposite = IMAGE_CATEGORIES[round.requested].opposite
  const wanted = round.rule === 'except'
    ? (t: RoundTile) => t.category !== round.requested
    : (t: RoundTile) => t.category === round.requested || t.category === opposite
  return round.tiles.filter(wanted).map((t) => t.token)
}

/**
 * Nine tiles: 0–3 of the requested category, 1–3 of its look-alike, the rest decoys.
 * `except` always shows at least one requested tile so there is something to leave out.
 */
export function createImageRound(random: () => number, token: () => string, rule: RuleId = pick(RULE_IDS, random)): ImageRound {
  const requested = pick(CATEGORIES, random)
  const opposite = IMAGE_CATEGORIES[requested].opposite
  const requestedCount = (rule === 'except' ? 1 : 0) + Math.floor(random() * (rule === 'except' ? 3 : 4))
  const oppositeCount = 1 + Math.floor(random() * 3)
  const of = (c: Category) => shuffle(SOURCE_IMAGES.filter((s) => s.category === c), random)
  const pairImages = [...of(requested).slice(0, requestedCount), ...of(opposite).slice(0, oppositeCount)]
  const decoys = shuffle(SOURCE_IMAGES.filter((s) => s.category !== requested && s.category !== opposite), random)
  const images = shuffle([...pairImages, ...decoys.slice(0, 9 - pairImages.length)], random)
  return {
    rule, requested, prompt: IMAGE_CATEGORIES[requested].label,
    instruction: RULES[rule].instruction, ordered: RULES[rule].ordered,
    tiles: images.map((s) => ({ token: token(), file: s.file, category: s.category })),
  }
}

/** Replay a click log into the final selection and the rhythm facts. */
export function clickRhythm(clicks: ImageClick[]) {
  const order: string[] = []
  let corrections = 0, maxGap = 0
  const gaps: number[] = []
  clicks.forEach((c, i) => {
    const at = order.indexOf(c.id)
    if (at >= 0) { order.splice(at, 1); corrections++ } else order.push(c.id)
    if (i > 0) { const g = c.t - clicks[i - 1].t; gaps.push(g); maxGap = Math.max(maxGap, g) }
  })
  const mean = gaps.reduce((a, g) => a + g, 0) / (gaps.length || 1)
  const cv = gaps.length > 1 && mean > 0 ? Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length) / mean : 0
  return { selection: order, corrections, maxGap, cv }
}

/** 0 = pure machine, 1 = hopelessly human. Shared by the verdict and the live meter. */
export function rhythmHumanity(r: { corrections: number; maxGap: number; cv: number }) {
  return Math.min(1, r.cv * 0.35 + r.corrections * 0.2 + Math.min(1, r.maxGap / MAX_GAP_MS) * 0.3)
}

export function scoreImageRound(round: ImageRound, clicks: ImageClick[]) {
  const rhythm = clickRhythm(clicks)
  const answer = answerFor(round)
  const picked = new Set(rhythm.selection)
  const wrong = rhythm.selection.filter((id) => !answer.includes(id)).length
  const missed = answer.filter((id) => !picked.has(id)).length
  const setCorrect = picked.size > 0 && wrong === 0 && missed === 0
  const orderCorrect = !round.ordered || rhythm.selection.every((id, i) => id === answer[i])
  const lookAlike = IMAGE_CATEGORIES[IMAGE_CATEGORIES[round.requested].opposite].label
  const skippedLookAlike = round.tiles.some((t) => t.category === IMAGE_CATEGORIES[round.requested].opposite && !picked.has(t.token))

  let reason: string, passed = false
  if (picked.size === 0) reason = 'Nothing selected.'
  else if (!setCorrect && skippedLookAlike && round.rule !== 'except') reason = `You left out the ${lookAlike}. A machine can’t tell them apart.`
  else if (!setCorrect && skippedLookAlike && round.rule === 'except') reason = `You also skipped the ${lookAlike}. Too discerning.`
  else if (!setCorrect) reason = `${wrong + missed} tile${wrong + missed === 1 ? '' : 's'} off. Not machine-like.`
  else if (!orderCorrect) reason = 'Right tiles, wrong order. Machines read left to right.'
  else if (rhythm.corrections > MAX_CORRECTIONS) reason = `Changed your mind ${rhythm.corrections} times. Machines don’t.`
  else if (rhythm.maxGap > MAX_GAP_MS) reason = `Paused ${(rhythm.maxGap / 1000).toFixed(1)}s between clicks. Machines don’t deliberate.`
  else { passed = true; reason = 'Visual confusion consistent with a machine.' }

  return { passed, wrong, missed, orderCorrect, ...rhythm, humanity: rhythmHumanity(rhythm), reason }
}
