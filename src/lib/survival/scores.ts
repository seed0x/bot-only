import type { SurvivalInputMode, SurvivalScoresResponse, SurvivalStageId } from '../types'

// Client-safe helpers for the survival leaderboard (no database imports).
export const SURVIVAL_INPUT_MODES: readonly Readonly<{ id: SurvivalInputMode; label: string }>[] = [
  { id: 'pointer', label: 'Pointer' },
  { id: 'touch_or_keyboard', label: 'Touch or keyboard' },
]
export const SURVIVAL_STAGE_LABELS: Readonly<Record<SurvivalStageId, string>> = { boot: 'Boot', observe: 'Observe', inspect: 'Inspect', audit: 'Audit', purge: 'Purge' }

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
export const isSurvivalScores = (v: unknown): v is SurvivalScoresResponse => record(v) && typeof v.rulesVersion === 'string' &&
  SURVIVAL_INPUT_MODES.some(mode => mode.id === v.inputMode) && Array.isArray(v.scores) && v.scores.every(row => record(row) &&
    typeof row.runId === 'string' && typeof row.handle === 'string' && typeof row.activeMs === 'number' && Number.isFinite(row.activeMs) && row.activeMs >= 0 &&
    count(row.completedObjectives) && count(row.roundsSurvived) && typeof row.stage === 'string' && Object.hasOwn(SURVIVAL_STAGE_LABELS, row.stage))

/** Survival time in seconds, truncated to tenths so a displayed time is never more than was survived. */
export const formatSurvivalSeconds = (activeMs: number) => (Math.floor(activeMs / 100) / 10).toFixed(1)
