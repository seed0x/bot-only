import { A, B, H, W, MAX_DEVIATION_PX } from '@/lib/motion'
import type { MotionSample } from '@/lib/types'
export default function AttemptEvidence({ samples, passed, live = false }: { samples: MotionSample[]; passed?: boolean; live?: boolean }) {
  const worst = samples.reduce<MotionSample | null>((p, s) => !p || Math.abs(s.y - A.y) > Math.abs(p.y - A.y) ? s : p, null)
  return <figure className="evidence">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={live ? 'Live motion trace' : 'Recorded motion evidence'}>
      <path d="M 0 50 H 640 M 0 100 H 640 M 0 150 H 640 M 0 200 H 640 M 0 250 H 640 M 60 0 V 300 M 190 0 V 300 M 320 0 V 300 M 450 0 V 300 M 580 0 V 300" className="evidence-grid" />
      <rect x={A.x} y={A.y - MAX_DEVIATION_PX} width={B.x - A.x} height={MAX_DEVIATION_PX * 2} className="evidence-band" />
      <path d={`M ${A.x} ${A.y} H ${B.x}`} className="evidence-ideal" />
      <polyline points={samples.map(s => `${s.x},${s.y}`).join(' ')} className={`evidence-trace ${passed === false ? 'rejected' : ''}`} />
      {!live && worst && Math.abs(worst.y - A.y) > MAX_DEVIATION_PX && <circle cx={worst.x} cy={worst.y} r="9" className="evidence-worst" />}
      {[['A', A], ['B', B]].map(([label, p]) => {
        const point = p as typeof A
        return <g key={label as string}><circle cx={point.x} cy={point.y} r="18" className="evidence-anchor" /><text x={point.x} y={point.y + 5} textAnchor="middle" className="evidence-label">{label as string}</text></g>
      })}
    </svg>
  </figure>
}
