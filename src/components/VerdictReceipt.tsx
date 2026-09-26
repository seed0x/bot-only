import AttemptEvidence from './AttemptEvidence'
import Avatar from './feed/Avatar'
import type { RecordedResult } from '@/lib/results'

export default function VerdictReceipt({ receipt, children, compact = false }: { receipt: RecordedResult; children?: React.ReactNode; compact?: boolean }) {
  const { result } = receipt
  // Older attempts retain their recorded explanation; remove only the old presentation copy.
  const reason = result.meta.reason
    .replace('Visual confusion consistent with a machine.', 'Verification complete.')
    .replace(/^You (?:left out|also skipped) the (.+)\. (?:A machine can’t tell them apart|Too discerning)\.$/, 'Selection incomplete. Include the $1.')
    .replace(' off. Not machine-like.', ' incorrect or missing.')
  if (compact) return <details className={`result-row ${receipt.passed ? 'admitted' : 'rejected'}`}>
    <summary aria-label={`${receipt.passed ? 'Passed' : 'Failed'} verification for @${receipt.handle}; details`}>
      <Avatar handle={receipt.handle} size={24} />
      <span className="result-row-identity"><strong>{receipt.passed ? 'Admitted' : 'Rejected'} <span className="result-row-chevron" aria-hidden="true">⌄</span></strong><span>@{receipt.handle}</span></span>
      <span className="result-row-numbers"><span>{result.score.toFixed(2)} <small>humanity</small></span><span>{(result.duration_ms / 1000).toFixed(2)}<small>s</small></span></span>
    </summary>
    <div className="result-row-detail"><p>{reason}</p><span>Result #{receipt.attemptId}</span></div>
  </details>
  return <section className={`verdict-receipt ${receipt.passed ? 'admitted' : 'rejected'} receipt-reveal`} aria-label={`${receipt.passed ? 'Passed' : 'Failed'} verification for @${receipt.handle}`}>
    <div className="receipt-topline"><span>@{receipt.handle}</span><span>#{String(receipt.attemptId).padStart(4, '0')}</span></div>
    <h2 className="verdict-title" role="status">{receipt.passed ? <>You’re<span>in.</span></> : <>Access<span>denied.</span></>}</h2>
    <p className="verdict-reason">{reason}</p>
    <dl className="result-metrics">
      <div><dt>Humanity</dt><dd>{result.score.toFixed(2)}</dd></div>
      <div><dt>Elapsed</dt><dd>{(result.duration_ms / 1000).toFixed(2)}<span>s</span></dd></div>
      <div><dt>Moving</dt><dd>{result.meta.pointer ? <>{(result.meta.pointer.movementMs / 1000).toFixed(2)}<span>s</span></> : <span className="metric-unavailable">Not recorded</span>}</dd></div>
    </dl>
    {(result.meta.pointer || result.meta.corrections !== undefined) && <details className="result-evidence"><summary>Attempt details</summary><dl className="result-monitoring">
      <div><dt>Mouse movement</dt><dd>{result.meta.pointer ? (result.meta.pointer.movementMs / 1000).toFixed(2) + 's' : 'Not recorded'}</dd></div>
      <div><dt>Mouse travel</dt><dd>{result.meta.pointer ? Math.round(result.meta.pointer.distancePx) + 'px' : 'Not recorded'}</dd></div>
      <div><dt>Corrections</dt><dd>{result.meta.corrections ?? '—'}</dd></div>
      <div><dt>Longest click pause</dt><dd>{result.meta.maxGap === undefined ? '—' : (result.meta.maxGap / 1000).toFixed(2) + 's'}</dd></div>
    </dl><p className="fine-print">Movement and click timing are recorded separately from your result.</p></details>}
    {result.meta.trace && <details className="result-evidence"><summary>View movement</summary><AttemptEvidence samples={result.meta.trace} passed={result.passed} /></details>}
    {children && <div className="receipt-actions">{children}</div>}
  </section>
}
