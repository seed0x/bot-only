import AttemptEvidence from './AttemptEvidence'
import Avatar from './feed/Avatar'
import type { RecordedResult } from '@/lib/results'

export default function VerdictReceipt({ receipt, children, compact = false }: { receipt: RecordedResult; children?: React.ReactNode; compact?: boolean }) {
  const { result } = receipt
  if (compact) return <details className={`result-row ${receipt.passed ? 'admitted' : 'rejected'}`}>
    <summary aria-label={`${receipt.passed ? 'Passed' : 'Failed'} verification for @${receipt.handle}; details`}>
      <Avatar handle={receipt.handle} size={24} />
      <span className="result-row-identity"><strong>{receipt.passed ? 'Admitted' : 'Rejected'} <span className="result-row-chevron" aria-hidden="true">⌄</span></strong><span>@{receipt.handle}</span></span>
      <span className="result-row-numbers"><span>{result.score.toFixed(2)} <small>humanity</small></span><span>{(result.duration_ms / 1000).toFixed(2)}<small>s</small></span></span>
    </summary>
    <div className="result-row-detail"><p>{result.meta.reason}</p><span>Result #{receipt.attemptId}</span></div>
  </details>
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
    {(result.meta.pointer || result.meta.corrections !== undefined) && <details className="result-evidence"><summary>Movement & timing</summary><dl className="result-monitoring">
      <div><dt>Mouse movement</dt><dd>{result.meta.pointer ? (result.meta.pointer.movementMs / 1000).toFixed(2) + 's' : 'Not recorded'}</dd></div>
      <div><dt>Mouse travel</dt><dd>{result.meta.pointer ? Math.round(result.meta.pointer.distancePx) + 'px' : 'Not recorded'}</dd></div>
      <div><dt>Corrections</dt><dd>{result.meta.corrections ?? '—'}</dd></div>
      <div><dt>Longest click pause</dt><dd>{result.meta.maxGap === undefined ? '—' : (result.meta.maxGap / 1000).toFixed(2) + 's'}</dd></div>
    </dl><p className="fine-print">Movement is measured in your browser. These metrics don’t change your pass or fail.</p></details>}
    {result.meta.trace && <details className="result-evidence"><summary>View movement</summary><AttemptEvidence samples={result.meta.trace} passed={result.passed} /></details>}
    {children && <div className="receipt-actions">{children}</div>}
  </section>
}
