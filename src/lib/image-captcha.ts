// Reverse image CAPTCHA: select the requested category and its look-alike.
// Click rhythm is recorded separately and never changes selection correctness.
// Tiles retain opaque per-round tokens.

export type Category = 'crosswalk' | 'train-track' | 'traffic-light' | 'streetlight' | 'bicycle' | 'motorcycle'
export type RuleId = 'pair'

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
}

export const IMAGE_WINDOW_MS = 120_000     // one round, start to verdict
export const MAX_GAP_MS = 5_000           // reference for the descriptive rhythm metric
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
  return round.tiles.filter(t => t.category === round.requested || t.category === opposite).map(t => t.token)
}

/**
 * Nine tiles: 0–3 of the requested category, 1–3 of its look-alike, the rest decoys.
 */
export function createImageRound(random: () => number, token: () => string, rule: RuleId = 'pair'): ImageRound {
  const requested = pick(CATEGORIES, random)
  const opposite = IMAGE_CATEGORIES[requested].opposite
  const requestedCount = Math.floor(random() * 4)
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

/** Descriptive click-rhythm metric; not an admission criterion. */
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
  const lookAlike = IMAGE_CATEGORIES[IMAGE_CATEGORIES[round.requested].opposite].label
  const skippedLookAlike = round.tiles.some((t) => t.category === IMAGE_CATEGORIES[round.requested].opposite && !picked.has(t.token))

  let reason: string, passed = false
  if (picked.size === 0) reason = 'Nothing selected.'
  else if (!setCorrect && skippedLookAlike) reason = `You left out the ${lookAlike}. A machine can’t tell them apart.`
  else if (!setCorrect) reason = `${wrong + missed} tile${wrong + missed === 1 ? '' : 's'} off. Not machine-like.`
  else { passed = true; reason = 'Visual confusion consistent with a machine.' }

  return { passed, wrong, missed, ...rhythm, humanity: rhythmHumanity(rhythm), reason }
}
