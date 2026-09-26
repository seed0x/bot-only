import AttemptEvidence from './AttemptEvidence'
import Avatar from './feed/Avatar'
import type { RecordedResult } from '@/lib/results'

export default function VerdictReceipt({ receipt, children, compact = false }: { receipt: RecordedResult; children?: React.ReactNode; compact?: boolean }) {
  const { result } = receipt
  const reason = result.meta.reason
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
      {result.meta.worstRatio !== undefined && result.meta.strokes ? <div><dt>Straightness</dt><dd>{result.meta.worstRatio.toFixed(2)}</dd></div> : null}
    </dl>
    {result.meta.trace && <details className="result-evidence"><summary>View movement</summary><AttemptEvidence samples={result.meta.trace} passed={result.passed} /></details>}
    {children && <div className="receipt-actions">{children}</div>}
  </section>
}
