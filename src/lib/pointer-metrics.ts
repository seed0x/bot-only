import type { PointerMetrics } from './types'
type Point = { x: number; y: number; t: number }
export type PointerMonitor = { last: Point | null; metrics: PointerMetrics }
export function newPointerMonitor(): PointerMonitor {
  return { last: null, metrics: { movementMs: 0, distancePx: 0, samples: 0 } }
}
// Sample at most 20Hz. Long gaps, tab switches and resize must not count as moving time.
export function observePointer(state: PointerMonitor, point: Point): PointerMonitor {
  if (![point.x, point.y, point.t].every(Number.isFinite) || point.t < 0) return state
  const previous = state.last
  const dt = previous ? point.t - previous.t : 0
  if (previous && dt < 50) return state
  const distance = previous ? Math.hypot(point.x - previous.x, point.y - previous.y) : 0
  return { last: point, metrics: {
    samples: state.metrics.samples + 1,
    distancePx: state.metrics.distancePx + distance,
    movementMs: state.metrics.movementMs + (distance > 0 && dt <= 250 ? dt : 0),
  } }
}
export function validPointerMetrics(value: unknown, windowMs: number): value is PointerMetrics {
  if (!value || typeof value !== 'object') return false
  const v = value as PointerMetrics
  return Number.isFinite(v.movementMs) && v.movementMs >= 0 && v.movementMs <= windowMs
    && Number.isFinite(v.distancePx) && v.distancePx >= 0 && v.distancePx <= 10_000_000
    && Number.isSafeInteger(v.samples) && v.samples >= 0 && v.samples <= 10000
}
