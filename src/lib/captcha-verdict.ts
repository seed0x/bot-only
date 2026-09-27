import type { SurvivalFailureReason, SurvivalMeasurement, SurvivalPointerSample } from './types'
import { SURVIVAL_FAILURE_PRECEDENCE, SURVIVAL_STAGES } from './survival/config'
import { evaluatePointer } from './survival/detectors'
import { clickRhythm, scoreImageRound, type ImageClick, type ImageRound } from './image-captcha'

// The reverse captcha judged by the survival game's own rules, at its opening stage ("boot"):
//   verification_failed  wrong tiles, or changing your mind more than once
//   objective_deadline   the round expired
//   idle                 a pause between actions longer than the stage's idle limit
//   pointer              more bad mouse strokes than the stage allows (Dashiell's straightness detector)
// Every crossed limit is kept as a SurvivalMeasurement in the plan's precedence order; the first is the
// primary reason. Pure, so the browser meter and the server verdict share it.

export const CAPTCHA_STAGE = SURVIVAL_STAGES[0]
export const MAX_CORRECTIONS = 0
export const CAPTCHA_IDLE_MS = 3000
export const CAPTCHA_BAD_STROKES = 1
export type Viewport = Readonly<{ width: number; height: number }>

export function pointerReport(strokes: readonly SurvivalPointerSample[][], viewport: Viewport) {
  let bad = 0, scored = 0, worst = 0
  let worstTrace: readonly SurvivalPointerSample[] | undefined
  for (const stroke of strokes) {
    const r = evaluatePointer(stroke, CAPTCHA_STAGE.id, viewport)
    if (r.outcome === 'insufficient_data' || r.value === null) continue
    scored++
    if (r.value > worst) worst = r.value
    if (r.outcome === 'bad') { bad++; if (r.pointerTrace && (!worstTrace || r.value >= worst)) worstTrace = r.pointerTrace }
  }
  return { bad, scored, worst, threshold: CAPTCHA_STAGE.pointerRatio, limit: CAPTCHA_BAD_STROKES, worstTrace }
}

export type CaptchaVerdict = {
  passed: boolean
  primaryReason: SurvivalFailureReason | null
  measurements: SurvivalMeasurement[]
  reason: string
  humanity: number
  selection: string[]
  corrections: number
  maxGap: number
  cv: number
  pointer: ReturnType<typeof pointerReport>
}

export function judgeCaptcha(input: {
  round: ImageRound; clicks: ImageClick[]; strokes: readonly SurvivalPointerSample[][]
  viewport: Viewport | null; elapsedMs: number; windowMs: number; expired: boolean
}): CaptchaVerdict {
  const { round, clicks, elapsedMs } = input
  const tiles = scoreImageRound(round, clicks)
  const rhythm = clickRhythm(clicks)
  const pointer = pointerReport(input.viewport ? input.strokes : [], input.viewport ?? { width: 1, height: 1 })
  const stage = CAPTCHA_STAGE.id, activeMs = elapsedMs
  const m: SurvivalMeasurement[] = []

  if (!tiles.passed) m.push({ reason: 'verification_failed', activeMs, stage, value: 1, threshold: 0, unit: 'boolean', explanation: tiles.reason })
  else if (rhythm.corrections > MAX_CORRECTIONS) m.push({ reason: 'verification_failed', activeMs, stage, value: 1, threshold: 0, unit: 'boolean', explanation: `Changed the selection ${rhythm.corrections} times.` })
  if (input.expired) m.push({ reason: 'objective_deadline', activeMs, stage, value: elapsedMs, threshold: input.windowMs, unit: 'ms', explanation: 'The round expired before verification.' })
  // idle: the longest gap from issue time through each click and the server receiving verification
  const gaps = clicks.map((c, i) => c.t - (i ? clicks[i - 1].t : 0))
  const longest = Math.max(0, ...gaps, elapsedMs - (clicks.at(-1)?.t ?? 0))
  if (longest >= CAPTCHA_IDLE_MS) m.push({ reason: 'idle', activeMs, stage, value: longest, threshold: CAPTCHA_IDLE_MS, unit: 'ms', explanation: `Paused ${(longest / 1000).toFixed(1)}s.` })
  if (pointer.bad >= pointer.limit) m.push({ reason: 'pointer', activeMs, stage, value: pointer.worst, threshold: pointer.threshold, unit: 'ratio', explanation: `${pointer.bad} curved mouse strokes.` })

  m.sort((a, b) => SURVIVAL_FAILURE_PRECEDENCE.indexOf(a.reason) - SURVIVAL_FAILURE_PRECEDENCE.indexOf(b.reason))
  const passed = m.length === 0 && rhythm.selection.length > 0
  const primary = m[0] ?? null
  // 0 = machine, 1 = human: how far each measured behaviour sits from the machine ideal
  const strokeShare = pointer.scored ? pointer.bad / pointer.scored : 0
  const humanity = passed
    ? Math.min(0.2, 0.02 + strokeShare * 0.1 + (pointer.worst / pointer.threshold) * 0.05 + rhythm.cv * 0.03)
    : Math.min(1, 0.5 + m.length * 0.12 + strokeShare * 0.2 + (rhythm.corrections > MAX_CORRECTIONS ? 0.1 : 0))
  const reason = passed ? (pointer.scored ? `Verification passed.` : tiles.reason) : primary!.explanation
  return { passed, primaryReason: primary?.reason ?? null, measurements: m, reason, humanity, selection: rhythm.selection, corrections: rhythm.corrections, maxGap: longest, cv: rhythm.cv, pointer }
}
