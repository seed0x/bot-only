import AttemptEvidence from './AttemptEvidence'
import HumanityInstrument from './HumanityInstrument'
import type { AttemptReceipt } from '@/lib/types'
export default function VerdictReceipt({ receipt, children }: { receipt: AttemptReceipt; children?: React.ReactNode }) {
  const { result } = receipt
  return <section className={`verdict-receipt ${receipt.passed ? 'admitted' : 'rejected'}`} aria-label="Recorded verdict">
    <div className="receipt-top eyebrow"><span>Result</span><span>No. {String(receipt.attemptId).padStart(5, '0')}</span></div>
    <h2 className="verdict-title">{receipt.passed ? <>You’re in.</> : <>Human detected.</>}</h2>
    <p className="receipt-handle">@{receipt.handle}</p>
    <p className="verdict-reason" role="status">{result.meta.reason}</p>
    {result.meta.trace && <AttemptEvidence samples={result.meta.trace} passed={result.passed} />}
    <HumanityInstrument score={result.score} wobble={result.meta.maxDev} hesitation={result.meta.speedCv} motion={result.challenge === 'straight-line'} />
    <div className="receipt-footer"><span>{(result.duration_ms / 1000).toFixed(2)}s {result.challenge === 'straight-line' ? 'trace duration' : 'server elapsed'}</span><span>Result #{receipt.attemptId}</span></div>
    {children && <div className="receipt-actions">{children}</div>}
  </section>
}
