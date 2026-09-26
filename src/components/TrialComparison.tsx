'use client'
import { usePollingResource } from '@/hooks/usePollingResource'
import AttemptEvidence from './AttemptEvidence'
import HumanityInstrument from './HumanityInstrument'
import type { AttemptReceipt } from '@/lib/types'
type Evidence = Pick<AttemptReceipt, 'attemptId' | 'handle' | 'passed' | 'result' | 'recordedAt'>
type Pair = { rejected: Evidence | null; admitted: Evidence | null }
function isPair(v: unknown): v is Pair {
  if (!v || typeof v !== 'object' || !('admitted' in v) || !('rejected' in v)) return false
  return [v.admitted, v.rejected].every(r => r === null || typeof r === 'object' && 'result' in r && !!r.result && typeof r.result === 'object' && 'meta' in r.result && !!r.result.meta && typeof r.result.meta === 'object' && 'trace' in r.result.meta && Array.isArray(r.result.meta.trace))
}
export default function TrialComparison() {
  const { data, error, refresh } = usePollingResource('/api/evidence', isPair, 3000)
  if (error) return <p className="error-state">Evidence updates paused. <button className="text-button" onClick={refresh}>Retry</button></p>
  if (!data || !data.rejected && !data.admitted) return null
  return <section className="comparison" aria-label="Motion evidence comparison">
    <div className="comparison-heading eyebrow"><span>Latest attempts</span><span></span></div>
    <div className="comparison-grid">{(['rejected', 'admitted'] as const).map(kind => {
      const r = data[kind]
      return <article key={kind} className="evidence-card is-holo">
        <span className="eyebrow" style={{ color: r ? kind === 'rejected' ? 'var(--danger)' : 'var(--verified)' : undefined }}>{kind === 'rejected' ? 'Human detected' : 'Passed'}</span>
        {r ? <><h3>@{r.handle}</h3><AttemptEvidence samples={r.result.meta.trace!} passed={r.passed} /><HumanityInstrument score={r.result.score} wobble={r.result.meta.maxDev} hesitation={r.result.meta.speedCv} compact /><div className="receipt-footer"><span>#{r.attemptId}</span><span>{(r.result.duration_ms / 1000).toFixed(2)}s trace</span></div></> : <p className="loading-state">No {kind} attempt yet.</p>}
      </article>
    })}</div>
  </section>
}
