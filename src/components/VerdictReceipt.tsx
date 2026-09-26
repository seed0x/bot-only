import AttemptEvidence from './AttemptEvidence'
import Avatar from './feed/Avatar'
import type { RecordedResult } from '@/lib/results'

export default function VerdictReceipt({ receipt, children, compact = false }: { receipt: RecordedResult; children?: React.ReactNode; compact?: boolean }) {
  const { result } = receipt
  return <section className={`verdict-receipt ${receipt.passed ? 'admitted' : 'rejected'}${compact ? ' receipt-compact' : ' receipt-reveal'}`} aria-label={`${receipt.passed ? 'Passed' : 'Failed'} verification for @${receipt.handle}`}>
    <div className="receipt-topline"><span>bot-only</span><span>#{String(receipt.attemptId).padStart(4, '0')}</span></div>
    <div className="result-heading">
      <h2 className="verdict-title" role={compact ? undefined : 'status'}>{receipt.passed ? 'Admitted.' : 'Rejected.'}</h2>
      <span className="result-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {receipt.passed ? <path d="m5 12 4 4 10-10" /> : <path d="m7 7 10 10M17 7 7 17" />}
      </svg></span>
    </div>
    <div className="receipt-identity"><Avatar handle={receipt.handle} size={28} /><span>@{receipt.handle}</span><span className="receipt-outcome">{receipt.passed ? 'Passed' : 'Failed'}</span></div>
    <p className="verdict-reason">{result.meta.reason}</p>
    <dl className="result-metrics">
      <div><dt>Humanity</dt><dd>{result.score.toFixed(2)}</dd></div>
      <div><dt>Time</dt><dd>{(result.duration_ms / 1000).toFixed(2)}<span>s</span></dd></div>
    </dl>
    {!compact && <div className="humanity-scale" aria-hidden="true"><span style={{ left: `${Math.min(100, Math.max(0, result.score * 100))}%` }} /></div>}
    {!compact && <div className="scale-labels"><span>Machine-like</span><span>Human-like</span></div>}
    {result.meta.trace && <details className="result-evidence"><summary>View movement</summary><AttemptEvidence samples={result.meta.trace} passed={result.passed} /></details>}
    {children && <div className="receipt-actions">{children}</div>}
  </section>
}
