// Reverse image captcha. The prompt names one thing; a machine "confuses" it with its opposite.
// Asked for crosswalks, the correct answer is train tracks (and crosswalks — the pair is interchangeable).
// Asked for traffic lights, the correct answer is streetlights. A human who picks what was asked is caught.
// Pure logic, shared by the server scorer and the smoke test. The browser only ever sees tiles and a prompt.

type Category = 'crosswalk' | 'train-track' | 'traffic-light' | 'streetlight' | 'bicycle' | 'motorcycle'

export const IMAGE_CATEGORIES: Record<Category, { label: string; opposite: Category; accepted?: Category[] }> = {
  crosswalk: { label: 'crosswalks', opposite: 'train-track', accepted: ['crosswalk', 'train-track'] },
  'train-track': { label: 'train tracks', opposite: 'crosswalk', accepted: ['crosswalk', 'train-track'] },
  'traffic-light': { label: 'traffic lights', opposite: 'streetlight' },
  streetlight: { label: 'streetlights', opposite: 'traffic-light' },
  bicycle: { label: 'bicycles', opposite: 'motorcycle' },
  motorcycle: { label: 'motorcycles', opposite: 'bicycle' },
}

const CATEGORIES = Object.keys(IMAGE_CATEGORIES) as Category[]

type Tile = { id: string; src: string; category: Category }
const TILES: Tile[] = CATEGORIES.flatMap((category) =>
  ['01', '02', '03'].map((n) => ({ id: `${category}-${n}`, src: `/images/${category}/${n}.webp`, category })),
)

// The tiles a machine should pick for a given prompt.
export function acceptedFor(requested: Category): Category[] {
  return IMAGE_CATEGORIES[requested].accepted ?? [IMAGE_CATEGORIES[requested].opposite]
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export type ImageRound = { requested: Category; prompt: string; tiles: Tile[] }

export function createImageRound(random: () => number): ImageRound {
  const requested = CATEGORIES[Math.floor(random() * CATEGORIES.length)]
  const accepted = acceptedFor(requested)
  const opposite = IMAGE_CATEGORIES[requested].opposite
  const decoys = CATEGORIES.filter((c) => c !== requested && c !== opposite)
  let tiles: Tile[]
  if (accepted.length > 1) {
    // interchangeable pair: 1–3 of each, filled to 9 with decoys
    const take = (c: Category) => shuffle(TILES.filter((t) => t.category === c), random).slice(0, 1 + Math.floor(random() * 3))
    const grouped = [...take(requested), ...take(opposite)]
    tiles = [...grouped, ...shuffle(TILES.filter((t) => decoys.includes(t.category)), random).slice(0, 9 - grouped.length)]
  } else {
    const decoy = decoys[Math.floor(random() * decoys.length)]
    tiles = TILES.filter((t) => t.category === requested || t.category === opposite || t.category === decoy)
  }
  return { requested, prompt: IMAGE_CATEGORIES[requested].label, tiles: shuffle(tiles, random) }
}

export function scoreImageRound(round: ImageRound, selected: string[]) {
  const picked = new Set(selected)
  const accepted = acceptedFor(round.requested)
  const correct = round.tiles.filter((t) => accepted.includes(t.category))
  const tookTheBait = round.tiles.some((t) => t.category === round.requested && !accepted.includes(t.category) && picked.has(t.id))
  const wrong = [...picked].filter((id) => !correct.some((t) => t.id === id)).length
  const missed = correct.filter((t) => !picked.has(t.id)).length
  const passed = picked.size > 0 && wrong === 0 && missed === 0
  const reason = passed
    ? 'Visual confusion consistent with a machine.'
    : tookTheBait
      ? `You selected actual ${round.prompt}. Human recognition detected.`
      : picked.size === 0
        ? 'Nothing selected.'
        : `${wrong + missed} tile${wrong + missed === 1 ? '' : 's'} off. Not machine-like.`
  return { passed, wrong, missed, tookTheBait, reason }
}
