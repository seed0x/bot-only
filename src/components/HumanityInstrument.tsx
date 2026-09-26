// Motion facts render only for motion tests; other tests show the humanity reading alone.
export default function HumanityInstrument({ score, wobble, hesitation, compact = false, motion = true }: { score: number | null; wobble?: number; hesitation?: number; compact?: boolean; motion?: boolean }) {
  return <div className={`instrument ${compact ? 'instrument-compact' : ''}`}>
    <div className="instrument-reading"><span className="instrument-value">{score === null ? '—' : score.toFixed(2)}</span><span className="eyebrow">humanity</span></div>
    {motion && <div className="instrument-facts">
      <span>{wobble === undefined ? '—' : wobble.toFixed(1)}<small>px wobble</small></span>
      <span>{hesitation === undefined ? '—' : (hesitation * 100).toFixed(0)}<small>% hesitation</small></span>
    </div>}
  </div>
}
