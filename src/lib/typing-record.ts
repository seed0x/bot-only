/** Draft-relative input evidence, independent of how long the document has been open. */
export type TypingRecord = { origin: number | null; samples: number[] }
export const newTypingRecord = (): TypingRecord => ({ origin: null, samples: [] })
export function recordTyping(record: TypingRecord, event: { inputType: string; timeStamp: number; isComposing?: boolean }) {
  if (event.inputType !== 'insertText' || event.isComposing) {
    record.origin = null; record.samples = []
    return
  }
  if (!Number.isFinite(event.timeStamp) || event.timeStamp < 0 || record.samples.length >= 400) return
  record.origin ??= event.timeStamp
  const t = event.timeStamp - record.origin
  if (t > 3_600_000 || t < 0) { record.origin = event.timeStamp; record.samples = [0]; return }
  if (!record.samples.length || t > record.samples[record.samples.length - 1]) record.samples.push(t)
}
