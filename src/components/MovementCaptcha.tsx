'use client'
import { useRef, useState } from 'react'
import AttemptEvidence from './AttemptEvidence'
import HumanityInstrument from './HumanityInstrument'
import { A, W, H, MAX_SAMPLES, analyse, humanity } from '@/lib/motion'
import type { MotionSample, Solution } from '@/lib/types'

export default function MovementCaptcha({ onSolution }: { onSolution: (s: Solution) => void }) {
  const run = useRef<{ start: number; samples: MotionSample[]; pointer: number } | null>(null)
  const finished = useRef(false)
  const [samples, setSamples] = useState<MotionSample[]>([])
  const [message, setMessage] = useState('Press A. Move in a straight line. Release at B.')
  function point(e: React.PointerEvent<HTMLDivElement>): MotionSample {
    const r = e.currentTarget.querySelector('svg')!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H, t: run.current ? performance.now() - run.current.start : 0 }
  }
  function start(e: React.PointerEvent<HTMLDivElement>) {
    if (finished.current || run.current || !e.isPrimary || e.button !== 0) return
    const p = point(e)
    if (Math.hypot(p.x - A.x, p.y - A.y) > 40) { setMessage('Start at A.'); return }
    e.currentTarget.setPointerCapture(e.pointerId)
    run.current = { start: performance.now(), samples: [{ ...p, t: 0 }], pointer: e.pointerId }
    setSamples(run.current.samples); setMessage('Release at B.')
  }
  function move(e: React.PointerEvent<HTMLDivElement>) {
    const current = run.current
    if (!current || current.pointer !== e.pointerId) return
    if (current.samples.length >= MAX_SAMPLES - 1) {
      run.current = null; setSamples([]); setMessage('Trial too long. Start again at A.'); return
    }
    const p = point(e), previous = current.samples.at(-1)!
    if (p.t - previous.t < 12) return
    current.samples = [...current.samples, p]; setSamples(current.samples)
  }
  function end(e: React.PointerEvent<HTMLDivElement>) {
    const current = run.current
    if (!current || current.pointer !== e.pointerId || finished.current) return
    const trace = [...current.samples, point(e)]
    finished.current = true; run.current = null; setSamples(trace)
    e.currentTarget.releasePointerCapture(e.pointerId)
    onSolution({ samples: trace })
  }
  function cancel() {
    if (!run.current) return
    run.current = null; setSamples([]); setMessage('Motion interrupted. No verdict recorded. Start at A.')
  }
  const metrics = samples.length ? analyse(samples) : null
  return <div className="motion-player">
    <p className="player-instruction" role="status">{message}</p>
    <div className="motion-surface" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel} onLostPointerCapture={cancel}>
      <AttemptEvidence samples={samples} live />
    </div>
    <HumanityInstrument score={metrics ? humanity(metrics.maxDev, metrics.speedCv) : null} wobble={metrics?.maxDev} hesitation={metrics?.speedCv} />
    <p className="fine-print">Use a mouse or touch screen.</p>
  </div>
}
