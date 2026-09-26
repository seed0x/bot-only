import AttemptEvidence from './AttemptEvidence'
import type { AttemptReceipt } from '@/lib/types'

export default function VerdictReceipt({ receipt, children }: { receipt: AttemptReceipt; children?: React.ReactNode }) {
  const { result } = receipt
  return <section className={`verdict-receipt ${receipt.passed ? 'admitted' : 'rejected'}`} aria-label="Verification result">
    <div className="result-heading">
      <span className="result-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {receipt.passed ? <path d="m5 12 4 4 10-10" /> : <path d="m7 7 10 10M17 7 7 17" />}
      </svg></span>
      <div><p className="result-label">Verification</p><h2 className="verdict-title">{receipt.passed ? 'Passed' : 'Failed'}</h2></div>
    </div>
    <p className="receipt-handle">@{receipt.handle}</p>
    <p className="verdict-reason" role="status">{result.meta.reason}</p>
    <dl className="result-metrics">
      <div><dt>Humanity</dt><dd>{result.score.toFixed(2)}</dd></div>
      <div><dt>Time</dt><dd>{(result.duration_ms / 1000).toFixed(2)}<span>s</span></dd></div>
    </dl>
    {result.meta.trace && <details className="result-evidence"><summary>View movement</summary><AttemptEvidence samples={result.meta.trace} passed={result.passed} /></details>}
    <p className="result-reference">Result #{receipt.attemptId}</p>
    {children && <div className="receipt-actions">{children}</div>}
  </section>
}
