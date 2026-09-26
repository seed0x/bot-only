import type { SurvivalDetector, SurvivalDetectorResult, SurvivalPointerSample, SurvivalStageId } from '../types'
import { SURVIVAL_SENSORS as limits, SURVIVAL_STAGES } from './config'

function result(detector: SurvivalDetector, stage: SurvivalStageId, value: number | null,
  explanation: string, structuralFailure = false): SurvivalDetectorResult {
  const config = SURVIVAL_STAGES.find(item => item.id === stage)
  if (!config) throw new RangeError('Unknown captured stage.')
  const threshold = detector === 'pointer' ? config.pointerRatio : detector === 'typing' ? config.typingCv : config.scrollCv
  return Object.freeze({ detector, stage, value, threshold, explanation,
    outcome: value === null ? 'insufficient_data' : structuralFailure || value > threshold ? 'bad' : 'good' })
}

/** One completed stroke in viewport CSS pixels. Collection/cadence/resets belong to G04.
 * Reject oversized windows rather than truncate them into a different verdict.
 */
export function evaluatePointer(samples: readonly SurvivalPointerSample[], stage: SurvivalStageId,
  viewport: Readonly<{ width: number; height: number }>): SurvivalDetectorResult {
  const insufficient = (why: string) => result('pointer', stage, null, why)
  if (samples.length < limits.pointerMinSamples || samples.length > limits.pointerMaxSamples) return insufficient('Pointer window needs 6–24 samples.')
  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) || viewport.width <= 0 || viewport.height <= 0) return insufficient('Pointer unavailable: invalid captured viewport.')
  const first = samples[0], last = samples[samples.length - 1]
  let path = 0
  for (let i = 0; i < samples.length; i++) {
    const point = samples[i], previous = samples[i - 1]
    if (![point.x, point.y, point.t].every(Number.isFinite) || point.t < 0 || point.x < 0 || point.x > viewport.width || point.y < 0 || point.y > viewport.height ||
      (previous && (point.t <= previous.t || point.t - previous.t > limits.pointerGapMs))) return insufficient('Invalid pointer coordinates or stroke timestamps; discard window.')
    if (previous) path += Math.hypot(point.x - previous.x, point.y - previous.y)
  }
  if (last.t - first.t > limits.pointerWindowMs || !Number.isFinite(path)) return insufficient('Invalid pointer duration or path; discard window.')
  if (path < limits.pointerMinPathPx) return insufficient('Pointer stroke is shorter than 60px.')
  const dx = last.x - first.x, dy = last.y - first.y
  const distance = Math.hypot(dx, dy)
  let deviation = 0
  for (const point of samples) {
    const projection = distance === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - first.x) * dx + (point.y - first.y) * dy) / (dx * dx + dy * dy)))
    deviation = Math.max(deviation, Math.hypot(point.x - first.x - projection * dx, point.y - first.y - projection * dy))
  }
  const loop = distance <= limits.pointerLoopDistancePx
  const scored = result('pointer', stage, deviation / Math.max(distance, limits.pointerMinPathPx),
    loop ? 'Qualified stroke loops or reverses back within 15px of its start.' : 'Maximum distance from the endpoint segment divided by endpoint distance (minimum 60px).', loop)
  if (scored.outcome !== 'bad') return scored
  return Object.freeze({ ...scored, pointerTrace: Object.freeze(samples.map(point => Object.freeze({ x: point.x / viewport.width, y: point.y / viewport.height, t: point.t - first.t }))) })
}

/** Population CV, scaled to avoid overflow from squaring large values. */
function coefficientOfVariation(values: readonly number[]): number | null {
  const scale = Math.max(...values)
  if (scale <= 0 || !Number.isFinite(scale)) return null
  const normalized = values.map(value => value / scale)
  const mean = normalized.reduce((sum, value) => sum + value, 0) / values.length
  return Math.sqrt(normalized.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length) / mean
}

/** Exactly nine insertion timestamps, with no characters, keys or field contents.
 * Adapter breaks bursts on paste/autofill/speech/composition/deletion/target changes.
 * Adjacent windows may share one timestamp, never an interval.
 */
export function evaluateTyping(timestamps: readonly number[], stage: SurvivalStageId): SurvivalDetectorResult {
  const insufficient = (why: string) => result('typing', stage, null, why)
  if (timestamps.length !== limits.typingMaxTimestamps) return insufficient('Typing window needs exactly eight insertion intervals.')
  const intervals: number[] = []
  for (let i = 0; i < timestamps.length; i++) {
    const time = timestamps[i]
    if (!Number.isFinite(time) || time < 0) return insufficient('Invalid typing timestamp; discard window.')
    if (i) {
      const interval = time - timestamps[i - 1]
      if (interval <= 0 || interval > limits.typingGapMs) return insufficient('Invalid interval or ended typing burst; discard window.')
      intervals.push(interval)
    }
  }
  const cv = coefficientOfVariation(intervals)
  return result('typing', stage, cv, 'Population CV of eight insertion intervals.')
}

/** Six consecutive signed net CSS-pixel displacements in 100ms bins from ONE
 * identified user-scroll container. Include internal zero bins. Adapter trims
 * burst edges, partitions without overlap and discards boundary-clipped tails.
 */
export function evaluateScroll(bins: readonly number[], stage: SurvivalStageId): SurvivalDetectorResult {
  const insufficient = (why: string) => result('scroll', stage, null, why)
  if (bins.length !== limits.scrollWindowBins || !bins.every(Number.isFinite)) return insufficient('Scroll window needs six finite displacement bins.')
  const movement = bins.reduce((sum, displacement) => sum + Math.abs(displacement), 0)
  if (!Number.isFinite(movement) || movement < limits.scrollMinMovementPx) return insufficient('Scroll window has less than 60px movement or invalid totals.')
  const reversal = bins.some(value => value > 0) && bins.some(value => value < 0)
  const cv = coefficientOfVariation(bins.map(Math.abs))
  return result('scroll', stage, cv, reversal ? 'Direction reversal within a qualified scroll window.' : 'Population CV of absolute speed in six 100ms bins.', reversal)
}
