import type { SurvivalFailureReason, SurvivalStage } from '../types'

// Bump this version whenever scoring, eligibility or limits change.
export const SURVIVAL_RULES_VERSION = 'survival-v4' as const
export const SURVIVAL_STAGES = Object.freeze(([
  { id: 'boot', startsAtMs: 0, idleLimitMs: 5000, pointerRatio: .08, typingCv: .35, typingMinWpm: 45, scrollCv: .60, objectiveBudgetMs: 15000, badWindowsToFail: 2 },
  { id: 'observe', startsAtMs: 20000, idleLimitMs: 4000, pointerRatio: .06, typingCv: .25, typingMinWpm: 55, scrollCv: .45, objectiveBudgetMs: 12000, badWindowsToFail: 1 },
  { id: 'inspect', startsAtMs: 40000, idleLimitMs: 3500, pointerRatio: .05, typingCv: .22, typingMinWpm: 60, scrollCv: .40, objectiveBudgetMs: 10000, badWindowsToFail: 1 },
  { id: 'audit', startsAtMs: 50000, idleLimitMs: 3000, pointerRatio: .045, typingCv: .20, typingMinWpm: 65, scrollCv: .35, objectiveBudgetMs: 9000, badWindowsToFail: 1 },
  { id: 'purge', startsAtMs: 60000, idleLimitMs: 2500, pointerRatio: .04, typingCv: .18, typingMinWpm: 70, scrollCv: .30, objectiveBudgetMs: 8000, badWindowsToFail: 1 },
] satisfies SurvivalStage[]).map(stage => Object.freeze(stage)))

/** Half-open stages cover every finite nonnegative active time, including fractions. */
export function survivalStageAt(activeMs: number): SurvivalStage {
  if (!Number.isFinite(activeMs) || activeMs < 0) throw new RangeError('Invalid active time.')
  return SURVIVAL_STAGES.findLast(stage => activeMs >= stage.startsAtMs)!
}
export const SURVIVAL_FAILURE_PRECEDENCE = Object.freeze([
  'verification_failed', 'objective_deadline', 'idle', 'pointer', 'typing', 'scroll',
] as const) satisfies readonly SurvivalFailureReason[]
export const SURVIVAL_TIMING = Object.freeze({ countdownMs: 3000, admissionBudgetMs: 60000, roundMs: 30000, hudHz: 10, idleWarningFraction: .75, activityDistancePx: 4 })
export const SURVIVAL_SENSORS = Object.freeze({
  pointerHz: 30, pointerGapMs: 180, pointerWindowMs: 750, pointerMinSamples: 6,
  pointerMaxSamples: 24, pointerMinPathPx: 60, pointerLoopDistancePx: 15,
  typingIntervals: 8, typingMaxTimestamps: 9, typingGapMs: 1500,
  scrollBinMs: 100, scrollGapMs: 250, scrollWindowBins: 6,
  scrollMaxBins: 6, scrollMinMovementPx: 60, scrollIntentGraceMs: 250,
})
// Bounds for future runtime validators; these constants do not validate HTTP by themselves.
export const SURVIVAL_LIMITS = Object.freeze({
  requestBodyBytes: 64000, finishBodyBytes: 16384, idMinLength: 16, idMaxLength: 100,
  activeMsMax: 86400000, objectivesMax: 6000, eligiblePostIdsMax: 100,
  measurementsMax: 6, explanationMaxLength: 240, pointerTraceMaxSamples: 24,
  normalizedCoordinateMin: 0, normalizedCoordinateMax: 1, cvMax: 1000000,
})
export const SURVIVAL_ID_PATTERN = /^[a-zA-Z0-9_-]{16,100}$/
