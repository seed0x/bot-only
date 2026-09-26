import type { CaptchaResult, MotionSample } from './types'

export const W = 640, H = 300
export const A = { x: 60, y: 150 }, B = { x: 580, y: 150 }
export const MAX_DEVIATION_PX = 14, MAX_SPEED_CV = 0.6, MIN_SAMPLES = 8
export const MAX_SAMPLES = 512
export const deviation = (s: MotionSample) => Math.abs(s.y - A.y)

export function analyse(samples: MotionSample[]) {
  const maxDev = samples.reduce((max, s) => Math.max(max, deviation(s)), 0)
  const speeds: number[] = []
  for (let i = 3; i < samples.length; i++) {
    const p = samples[i - 3], q = samples[i], dt = q.t - p.t
    if (dt > 0) speeds.push(Math.hypot(q.x - p.x, q.y - p.y) / dt)
  }
  const mean = speeds.reduce((sum, n) => sum + n, 0) / (speeds.length || 1)
  const variance = speeds.reduce((sum, n) => sum + (n - mean) ** 2, 0) / (speeds.length || 1)
  return { maxDev, speedCv: mean ? Math.sqrt(variance) / mean : 1 }
}
export function humanity(maxDev: number, speedCv: number) {
  return Math.min(1, maxDev / (MAX_DEVIATION_PX * 3) * 0.5 + speedCv / (MAX_SPEED_CV * 2.5) * 0.5)
}
export function scoreMotion(samples: MotionSample[], expired = false): CaptchaResult {
  const { maxDev, speedCv } = analyse(samples)
  const first = samples[0], last = samples.at(-1)
  const startsA = !!first && Math.hypot(first.x - A.x, first.y - A.y) <= 40
  const reachesB = !!last && Math.hypot(last.x - B.x, last.y - B.y) < 40
  const reason = expired ? 'Time’s up. Try again.'
    : !startsA ? 'Did not start at A.'
    : samples.length < MIN_SAMPLES ? 'Too little motion to measure.'
    : !reachesB ? 'Finish at B.'
    : maxDev > MAX_DEVIATION_PX ? `Your line was ${maxDev.toFixed(1)}px off the line.`
    : speedCv > MAX_SPEED_CV ? `You hesitated. Speed varied ${(speedCv * 100).toFixed(0)}%.`
    : 'Straight line. Steady speed.'
  const passed = !expired && startsA && reachesB && samples.length >= MIN_SAMPLES && maxDev <= MAX_DEVIATION_PX && speedCv <= MAX_SPEED_CV
  return { challenge: 'straight-line', passed, score: humanity(maxDev, speedCv),
    duration_ms: first && last ? Math.round(last.t - first.t) : 0,
    meta: { reason, maxDev, speedCv, trace: samples } }
}
export function scoreHash(expected: string, value: string, duration: number): CaptchaResult {
  let errors = Math.abs(value.length - expected.length)
  for (let i = 0; i < Math.min(value.length, expected.length); i++) if (value[i] !== expected[i]) errors++
  const passed = value === expected && duration <= 4000
  const reason = duration > 4000 ? 'Time’s up.'
    : errors ? `${errors} incorrect character${errors === 1 ? '' : 's'}.`
    : `Exact response in ${(duration / 1000).toFixed(2)}s.`
  return { challenge: 'hash-recall', passed, score: Math.min(1, errors / 8 * 0.6 + duration / 8000 * 0.4), duration_ms: duration, meta: { reason, errors } }
}
