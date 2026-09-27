import type { SurvivalBindReceipt, SurvivalObjectiveReceipt, SurvivalObjectiveSubmission, SurvivalStartReceipt } from '../types'
import { SURVIVAL_ID_PATTERN, SURVIVAL_RULES_VERSION } from './config'
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0
const id = (v: unknown): v is string => typeof v === 'string' && SURVIVAL_ID_PATTERN.test(v)
const user = (v: unknown) => record(v) && positive(v.id) && typeof v.handle === 'string' && /^[a-z0-9_]{1,24}$/.test(v.handle) && v.handle !== 'system'
const iso = (v: unknown) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v))
export const isStartReceipt = (v: unknown): v is SurvivalStartReceipt => record(v) && v.ok === true && id(v.runId) && id(v.requestId) && v.rulesVersion === SURVIVAL_RULES_VERSION && ['pointer', 'touch_or_keyboard'].includes(String(v.inputMode)) && iso(v.startedAt)
export const isBindReceipt = (v: unknown): v is SurvivalBindReceipt => record(v) && v.ok === true && id(v.runId) && id(v.requestId) && user(v.user)
export function isCompletion(v: unknown, g: SurvivalObjectiveSubmission): v is SurvivalObjectiveReceipt {
  if (!record(v) || v.runId !== g.runId || v.objectiveId !== g.objectiveId || v.requestId !== g.requestId || !id(v.completionId) || !user(v.user) || !iso(v.recordedAt) || !record(v.action) || v.action.kind !== g.kind) return false
  return g.kind === 'admission' ? positive(v.action.attemptId) : g.kind === 'post' ? positive(v.action.postId) : positive(v.action.likeId) && positive(v.action.postId)
}
