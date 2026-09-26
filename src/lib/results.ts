import type { AttemptReceipt } from './types'

export type RecordedResult = Pick<AttemptReceipt, 'attemptId' | 'handle' | 'passed' | 'result' | 'recordedAt'>
export function isResults(value: unknown): value is RecordedResult[] {
  return Array.isArray(value) && value.every(row => {
    if (!row || typeof row !== 'object') return false
    const result = row.result
    return Number.isSafeInteger(row.attemptId) && typeof row.handle === 'string' && typeof row.passed === 'boolean'
      && typeof row.recordedAt === 'string' && result?.challenge === 'image-confusion'
      && result.passed === row.passed && Number.isFinite(result.score) && result.score >= 0 && result.score <= 1
      && Number.isFinite(result.duration_ms) && result.duration_ms >= 0 && typeof result.meta?.reason === 'string'
  })
}
