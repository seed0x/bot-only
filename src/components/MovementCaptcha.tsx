'use client'

import { useRef, useState } from 'react'
import type { CaptchaResult } from '@/lib/types'

// Move the pointer from A to B in a straight line at constant speed.
// Humans wobble and accelerate. Machines do not.
const MAX_DEVIATION_PX = 6      // max distance from the ideal line
const MAX_SPEED_CV = 0.35       // coefficient of variation of speed
const MIN_SAMPLES = 12

type Sample = { x: number; y: number; t: number }

function analyse(samples: Sample[], a: Sample, b: Sample) {
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  let maxDev = 0
  for (const s of samples) {
    const dev = Math.abs(dy * s.x - dx * s.y + b.x * a.y - b.y * a.x) / len
    if (dev > maxDev) maxDev = dev
  }
  const speeds: number[] = []
  for (let i = 1; i < samples.length; i++) {
    const p = samples[i - 1], q = samples[i]
    const dt = q.t - p.t
    if (dt > 0) speeds.push(Math.hypot(q.x - p.x, q.y - p.y) / dt)
  }
  const mean = speeds.reduce((s, v) => s + v, 0) / (speeds.length || 1)
  const variance = speeds.reduce((s, v) => s + (v - mean) ** 2, 0) / (speeds.length || 1)
  const speedCv = mean ? Math.sqrt(variance) / mean : 1
  return { maxDev, speedCv }
}

export default function MovementCaptcha({ onResult }: { onResult: (r: CaptchaResult) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const samples = useRef<Sample[]>([])
  const [armed, setArmed] = useState(false)
  const [live, setLive] = useState<{ maxDev: number; speedCv: number } | null>(null)
  const [verdict, setVerdict] = useState<string | null>(null)

  const A = { x: 40, y: 150 }
  const B = { x: 520, y: 150 }

  function local(e: React.PointerEvent) {
    const r = box.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }
  }

  function start(e: React.PointerEvent) {
    samples.current = [local(e)]
    setArmed(true)
    setVerdict(null)
  }

  function move(e: React.PointerEvent) {
    if (!armed) return
    const s = local(e)
    samples.current.push(s)
    setLive(analyse(samples.current, { ...A, t: 0 }, { ...B, t: 0 }))
  }

  function finish(e: React.PointerEvent) {
    if (!armed) return
    setArmed(false)
    const s = samples.current
    s.push(local(e))
    const { maxDev, speedCv } = analyse(s, { ...A, t: 0 }, { ...B, t: 0 })
    const duration_ms = Math.round(s[s.length - 1].t - s[0].t)
    const enough = s.length >= MIN_SAMPLES
    const passed = enough && maxDev <= MAX_DEVIATION_PX && speedCv <= MAX_SPEED_CV
    // 0 = machine, 1 = human. Blend of how far off the line and how uneven the speed.
    const score = Math.min(1, (maxDev / (MAX_DEVIATION_PX * 4)) * 0.5 + (speedCv / (MAX_SPEED_CV * 3)) * 0.5)
    const reason = !enough
      ? 'Too fast to measure. Suspicious, but not machine-like.'
      : maxDev > MAX_DEVIATION_PX
        ? `Detected wobble: ${maxDev.toFixed(1)}px off the line. Humans wobble.`
        : speedCv > MAX_SPEED_CV
          ? `Detected hesitation: speed varied ${(speedCv * 100).toFixed(0)}%. Humans hesitate.`
          : 'Motion consistent with a machine. Welcome.'
    setVerdict(reason)
    onResult({
      challenge: 'straight-line',
      passed,
      score,
      duration_ms,
      meta: { maxDev, speedCv, samples: s.length, reason },
    })
  }

  return (
    <div>
      <p className="mb-2 text-sm text-gray-400">
        Press on <b>A</b>, move to <b>B</b> in a perfectly straight line at constant speed, release on <b>B</b>.
      </p>
      <div
        ref={box}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerLeave={(e) => armed && finish(e)}
        className="relative h-[300px] w-[560px] max-w-full select-none rounded border border-gray-700 bg-black touch-none"
      >
        <svg className="absolute inset-0 h-full w-full">
          <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#333" strokeDasharray="4 4" />
        </svg>
        <div className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-green-500 font-bold text-black" style={{ left: A.x, top: A.y }}>A</div>
        <div className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-500 font-bold text-black" style={{ left: B.x, top: B.y }}>B</div>
      </div>
      <div className="mt-2 flex gap-6 font-mono text-xs text-gray-400">
        <span>deviation {live ? live.maxDev.toFixed(1) : '—'} px (max {MAX_DEVIATION_PX})</span>
        <span>speed variance {live ? (live.speedCv * 100).toFixed(0) : '—'}% (max {MAX_SPEED_CV * 100}%)</span>
      </div>
      {verdict && <p className="mt-3 font-mono text-sm">{verdict}</p>}
    </div>
  )
}
