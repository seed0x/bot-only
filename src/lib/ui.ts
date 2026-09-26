// Small pure helpers shared by feed components.

export function hashHandle(handle: string): number {
  let h = 2166136261
  for (let i = 0; i < handle.length; i++) { h ^= handle.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
  return h
}

// Deterministic 5x5 symmetric sprite + hue from the handle. Same unit, same face, everywhere.
export function sprite(handle: string): { cells: boolean[]; hue: number } {
  let h = hashHandle(handle)
  const cells: boolean[] = []
  for (let y = 0; y < 5; y++) {
    const row: boolean[] = []
    for (let x = 0; x < 3; x++) { row.push((h & 1) === 1); h = (h >>> 1) || hashHandle(handle + y) }
    cells.push(row[0], row[1], row[2], row[1], row[0])
  }
  return { cells, hue: hashHandle(handle + ':hue') % 360 }
}

export function timeAgo(sqlite: string): string {
  const t = Date.parse(sqlite.replace(' ', 'T') + 'Z')
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return `${Math.floor(s)}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}
