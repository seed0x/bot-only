import type { SurvivalPointerSample } from '../types'
import { SURVIVAL_SENSORS as limits } from './config'

// Turns a stream of pointer positions into the bounded strokes the survival pointer detector scores.
// Pure and framework-free, so the captcha uses it today and the game runtime (G04) can reuse it.
// Cadence rules from the plan: sample at most 30 Hz; a stroke ends after a 180 ms gap, 750 ms of
// duration, a pointer down/up, or at 24 samples (the next stroke starts from that last point, so
// consecutive windows share one endpoint but never re-score a segment). Coordinates are viewport
// CSS pixels; time is any monotonic millisecond clock.

export type PointerCollector = {
  current: SurvivalPointerSample[]
  strokes: SurvivalPointerSample[][]
}

export const MAX_STROKES = 40

export function newPointerCollector(): PointerCollector {
  return { current: [], strokes: [] }
}

function close(c: PointerCollector, carry: SurvivalPointerSample | null) {
  if (c.current.length >= limits.pointerMinSamples && c.strokes.length < MAX_STROKES) c.strokes.push(c.current)
  c.current = carry ? [carry] : []
}

/** Feed one pointer position. Returns the collector (mutated) for chaining. */
export function observe(c: PointerCollector, point: SurvivalPointerSample): PointerCollector {
  if (![point.x, point.y, point.t].every(Number.isFinite)) return c
  const last = c.current.at(-1)
  if (last) {
    const dt = point.t - last.t
    if (dt < 1000 / limits.pointerHz) return c                         // cap the sampling rate
    if (dt > limits.pointerGapMs) close(c, null)                        // a pause ends the stroke
    else if (point.t - c.current[0].t > limits.pointerWindowMs) close(c, last)  // too long: split, share the endpoint
    else if (c.current.length >= limits.pointerMaxSamples) close(c, last)      // too many: split, share the endpoint
  }
  c.current.push(point)
  return c
}

/** A pointer down/up, scroll, resize, blur or focus change: end the stroke without carrying a point. */
export function interrupt(c: PointerCollector): PointerCollector {
  close(c, null)
  return c
}

/** Everything scorable so far, including the stroke still in progress if it qualifies. */
export function collected(c: PointerCollector): SurvivalPointerSample[][] {
  const tail = c.current.length >= limits.pointerMinSamples && c.strokes.length < MAX_STROKES ? [c.current] : []
  return [...c.strokes, ...tail]
}
