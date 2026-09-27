import type { SurvivalFinishRequest, SurvivalFinishReceipt, SurvivalBindReceipt, SurvivalObjectiveReceipt, SurvivalObjectiveSubmission, SurvivalStartReceipt } from '../types'
import { SURVIVAL_ID_PATTERN, SURVIVAL_RULES_VERSION } from './config'
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0
const id = (v: unknown): v is string => typeof v === 'string' && SURVIVAL_ID_PATTERN.test(v)
const user = (v: unknown) => record(v) && positive(v.id) && typeof v.handle === 'string' && v.handle.length <= 40 && /^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/.test(v.handle) && v.handle !== 'system'
const iso = (v: unknown) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v))
export const isStartReceipt = (v: unknown): v is SurvivalStartReceipt => record(v) && v.ok === true && id(v.runId) && id(v.requestId) && v.rulesVersion === SURVIVAL_RULES_VERSION && ['pointer', 'touch_or_keyboard'].includes(String(v.inputMode)) && iso(v.startedAt)
export const isBindReceipt = (v: unknown): v is SurvivalBindReceipt => record(v) && v.ok === true && id(v.runId) && id(v.requestId) && user(v.user)
export function isCompletion(v: unknown, g: SurvivalObjectiveSubmission): v is SurvivalObjectiveReceipt {
  if (!record(v) || v.runId !== g.runId || v.objectiveId !== g.objectiveId || v.requestId !== g.requestId || !id(v.completionId) || !user(v.user) || !iso(v.recordedAt) || !record(v.action) || v.action.kind !== g.kind) return false
  return g.kind === 'admission' ? positive(v.action.attemptId) : g.kind === 'post' ? positive(v.action.postId) : positive(v.action.likeId) && positive(v.action.postId)
}

export const isFinishReceipt = (v: unknown): v is SurvivalFinishReceipt => record(v) && v.ok === true && id(v.runId) && id(v.requestId) && id(v.resultId) && typeof v.ranked === 'boolean' && iso(v.recordedAt)

/** Bounded recovery data only. The server revalidates every field before acknowledging it. */
export function isFinishRequest(v: unknown): v is SurvivalFinishRequest {
  if (!record(v) || !id(v.requestId) || !record(v.snapshot)) return false
  const s = v.snapshot
  return id(s.runId) && s.rulesVersion === SURVIVAL_RULES_VERSION && ['pointer', 'touch_or_keyboard'].includes(String(s.inputMode))
    && typeof s.activeMs === 'number' && Number.isFinite(s.activeMs) && s.activeMs >= 0 && s.activeMs <= 86400000
    && ['boot', 'observe', 'inspect', 'audit', 'purge'].includes(String(s.stage))
    && Array.isArray(s.completedObjectiveIds) && s.completedObjectiveIds.length <= 6000 && s.completedObjectiveIds.every(id)
    && Array.isArray(s.measurements) && s.measurements.length <= 6 && s.measurements.every(m => record(m) && typeof m.explanation === 'string' && m.explanation.length <= 240 && typeof m.value === 'number' && Number.isFinite(m.value) && typeof m.threshold === 'number' && Number.isFinite(m.threshold))
    && (s.status === 'failed' && s.measurements.length > 0 && typeof s.primaryReason === 'string' || s.status === 'interrupted' && ['reload', 'closed'].includes(String(s.interruption)) && s.measurements.length === 0)
}
