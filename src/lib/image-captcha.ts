type Category = 'crosswalk' | 'train-track' | 'traffic-light' | 'streetlight' | 'bicycle' | 'motorcycle'

export const IMAGE_CATEGORIES: Record<Category, { label: string; opposite: Category }> = {
  crosswalk: { label: 'crosswalks', opposite: 'train-track' },
  'train-track': { label: 'train tracks', opposite: 'crosswalk' },
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

export function acceptedFor(requested: Category): Category[] {
  return [requested, IMAGE_CATEGORIES[requested].opposite]
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export type ImageRound = { requested: Category; prompt: string; tiles: Tile[] }

export function createImageRound(random: () => number): ImageRound {
  const requested = CATEGORIES[Math.floor(random() * CATEGORIES.length)]
  const opposite = IMAGE_CATEGORIES[requested].opposite
  const pair = acceptedFor(requested)
  const requestedCount = Math.floor(random() * 4)
  const oppositeCount = 1 + Math.floor(random() * 3)
  const pairTiles = [
    ...shuffle(TILES.filter((tile) => tile.category === requested), random).slice(0, requestedCount),
    ...shuffle(TILES.filter((tile) => tile.category === opposite), random).slice(0, oppositeCount),
  ]
  const fillerCategories = CATEGORIES.filter((category) => !pair.includes(category))
  const fillers = shuffle(TILES.filter((tile) => fillerCategories.includes(tile.category)), random)
  const tiles = shuffle([...pairTiles, ...fillers.slice(0, 9 - pairTiles.length)], random)
  return { requested, prompt: IMAGE_CATEGORIES[requested].label, tiles }
}

export function scoreImageRound(round: ImageRound, selected: string[]) {
  const picked = new Set(selected)
  const accepted = acceptedFor(round.requested)
  const correct = round.tiles.filter((tile) => accepted.includes(tile.category))
  const wrong = [...picked].filter((id) => !correct.some((tile) => tile.id === id)).length
  const missed = correct.filter((tile) => !picked.has(tile.id)).length
  const passed = picked.size > 0 && wrong === 0 && missed === 0
  const reason = passed
    ? 'Visual confusion consistent with a machine.'
    : picked.size === 0
      ? 'Nothing selected.'
      : `${wrong + missed} tile${wrong + missed === 1 ? '' : 's'} off. Not machine-like.`
  return { passed, wrong, missed, reason }
}
