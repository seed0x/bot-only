/** Calibrate the issued wall-clock window once, then advance on a monotonic clock. */
export function challengeClock(startedAt: number, expiresAt: number, wallNow: number, monotonicNow: number) {
  const windowMs = Math.max(0, expiresAt - startedAt)
  const elapsed = Math.max(0, wallNow - startedAt)
  return { origin: monotonicNow - elapsed, deadline: monotonicNow + Math.min(windowMs, Math.max(0, expiresAt - wallNow)) }
}
