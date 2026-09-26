// How a machine passes the reverse image captcha: it never sees a file name, so it recognises each
// tile by hashing the image bytes against the dataset it was built from, then applies the rule
// literally and clicks at a perfectly even rhythm. Used by the smoke tests and the machine client.
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const DATASET = path.join(import.meta.dirname, '..', 'assets', 'captcha')
const OPPOSITE = { crosswalk: 'train-track', 'train-track': 'crosswalk', 'traffic-light': 'streetlight', streetlight: 'traffic-light', bicycle: 'motorcycle', motorcycle: 'bicycle' }
const LABEL = { crosswalks: 'crosswalk', 'train tracks': 'train-track', 'traffic lights': 'traffic-light', streetlights: 'streetlight', bicycles: 'bicycle', motorcycles: 'motorcycle' }
const RULE = { 'Select all images with': 'pair' }
const sha = bytes => createHash('sha256').update(bytes).digest('hex')

let manifest
async function dataset() {
  if (manifest) return manifest
  manifest = new Map()
  for (const category of await readdir(DATASET)) {
    for (const file of await readdir(path.join(DATASET, category))) manifest.set(sha(await readFile(path.join(DATASET, category, file))), category)
  }
  return manifest
}

/** Recognise every tile: returns [{ id, category }] in grid order. `fetchTile(src)` returns the bytes. */
export async function recognise(challenge, fetchTile) {
  const known = await dataset()
  return Promise.all(challenge.tiles.map(async tile => {
    const category = known.get(sha(Buffer.from(await fetchTile(tile.src))))
    if (!category) throw new Error('Unrecognised tile ' + tile.id)
    return { id: tile.id, category }
  }))
}

/** The machine answer, in grid order, for the look-alike pair rule. */
export function machineAnswer(challenge, tiles) {
  const requested = LABEL[challenge.prompt], rule = RULE[challenge.instruction]
  if (!requested || !rule) throw new Error(`Unknown round: ${challenge.instruction} ${challenge.prompt}`)
  const keep = t => t.category === requested || t.category === OPPOSITE[requested]
  return { rule, requested, ids: tiles.filter(keep).map(t => t.id) }
}

/** A perfectly even click log for a list of ids. */
export const steadyClicks = (ids, start = 180, every = 140) => ids.map((id, i) => ({ id, t: start + i * every }))

/** Recognise, answer and produce the click log a machine would submit. */
export async function solveImage(challenge, fetchTile) {
  const tiles = await recognise(challenge, fetchTile)
  const answer = machineAnswer(challenge, tiles)
  return { ...answer, tiles, clicks: steadyClicks(answer.ids) }
}
