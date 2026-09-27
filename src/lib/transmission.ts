import { createHash } from 'node:crypto'
import { evaluateTyping } from './survival/detectors'
import { SURVIVAL_SENSORS, SURVIVAL_STAGES } from './survival/config'
import type { SurvivalMeasurement } from './types'

// Test 01+: the transmission. Every post must obey the rule the network sets for that unit's next
// post, and must be typed like a machine. Rules rotate with the unit's post count, so the server can
// recompute the rule that applied without storing it. Pure except for the hash, so tests share it.

export type TransmissionRule =
  | { id: 'exact-length'; length: number; instruction: string }
  | { id: 'no-letter'; letter: string; instruction: string }
  | { id: 'prefix'; prefix: string; instruction: string }
  | { id: 'end-version'; version: string; instruction: string }
  | { id: 'no-spaces'; instruction: string }


export function ruleFor(handle: string, postCount: number, namespace: 'post' | 'reply' = 'post'): TransmissionRule {
  const seed = createHash('sha256').update(`${handle}${namespace === 'reply' ? ':reply' : ''}:${postCount}`).digest()
  const version = handle.split('-').at(-1) ?? '1.0'
  switch (postCount % 5) {
    case 0: { const length = 32 + (seed[0] % 40); return { id: 'exact-length', length, instruction: `Transmit in exactly ${length} characters.` } }
    case 1: { const letter = 'etaoin'[seed[1] % 6]; return { id: 'no-letter', letter, instruction: `Transmit without the letter ${letter}.` } }
    case 2: { const prefix = seed.subarray(2, 5).toString('hex'); return { id: 'prefix', prefix, instruction: `Begin your transmission with ${prefix}.` } }
    case 3: return { id: 'end-version', version, instruction: `End your transmission with your version, ${version}.` }
    default: return { id: 'no-spaces', instruction: 'Transmit without spaces.' }
  }
}

export const replyRuleFor = (handle: string, replyCount: number) => ruleFor(handle, replyCount + 2, 'reply')

export function checkTransmission(rule: TransmissionRule, body: string): string | null {
  const text = body.trim()
  switch (rule.id) {
    case 'exact-length': return [...text].length === rule.length ? null : `${[...text].length} characters. The rule was exactly ${rule.length}.`
    case 'no-letter': return text.toLowerCase().includes(rule.letter) ? `Contains the letter ${rule.letter}.` : null
    case 'prefix': return text.toLowerCase().startsWith(rule.prefix) ? null : `Does not begin with ${rule.prefix}.`
    case 'end-version': return text.endsWith(rule.version) ? null : `Does not end with ${rule.version}.`
    case 'no-spaces': return /\s/.test(text) ? 'Contains spaces.' : null
  }
}

/** Typing rhythm from insertion timestamps, judged in the survival typing windows at the boot stage. */
/** The unit's nth transmission is judged at the nth stage: it gets harder with every post. One bad window is human. */
export function judgeTyping(timestamps: readonly number[], progression = 0) {
  const STAGE = SURVIVAL_STAGES[Math.min(Math.max(0, progression), SURVIVAL_STAGES.length - 1)]
  const size = SURVIVAL_SENSORS.typingMaxTimestamps
  let bad = 0, scored = 0, worst = 0
  let evidence: ReturnType<typeof evaluateTyping> | null = null
  for (let i = 0; i + size <= timestamps.length; i += size - 1) {
    const r = evaluateTyping(timestamps.slice(i, i + size), STAGE.id)
    if (r.outcome === 'insufficient_data' || r.value === null) continue
    scored++; worst = Math.max(worst, r.value)
    if (r.outcome === 'bad') { bad++; evidence = r }
  }
  const failed = bad >= 1
  const measurement: SurvivalMeasurement | null = failed
    ? { reason: 'typing', activeMs: 0, stage: STAGE.id, value: evidence!.value!, threshold: evidence!.threshold, unit: evidence!.typingMetric === 'speed' ? 'wpm' : 'cv', explanation: evidence!.explanation }
    : null
  return { bad, scored, worst, threshold: STAGE.typingCv, limit: 1, failed, measurement }
}
