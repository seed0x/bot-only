'use client'

import { useEffect, useRef, useState } from 'react'
import type { CaptchaResult } from '@/lib/types'

// Reverse captcha: move the pointer from A to B like a machine would.
// Straight line, constant speed. Humans wobble and hesitate; the trail shows it live.
// Thresholds are deliberately loose for now so a careful human can pass. Tighten later.
export const MAX_DEVIATION_PX = 14   // max distance from the ideal line
export const MAX_SPEED_CV = 0.6      // std / mean of speed across the drag
export const MIN_SAMPLES = 8

const W = 640, H = 300
const A = { x: 60, y: 150 }
const B = { x: 580, y: 150 }

type Sample = { x: number; y: number; t: number }

function deviation(s: { x: number; y: number }) {
  const dx = B.x - A.x, dy = B.y - A.y
  return Math.abs(dy * s.x - dx * s.y + B.x * A.y - B.y * A.x) / Math.hypot(dx, dy)
}

function analyse(samples: Sample[]) {
  let maxDev = 0
  for (const s of samples) maxDev = Math.max(maxDev, deviation(s))
  // speed over a 3-sample window smooths pointer-event jitter without hiding real hesitation
  const speeds: number[] = []
  for (let i = 3; i < samples.length; i++) {
    const p = samples[i - 3], q = samples[i]
    const dt = q.t - p.t
    if (dt > 0) speeds.push(Math.hypot(q.x - p.x, q.y - p.y) / dt)
  }
  const mean = speeds.reduce((a, v) => a + v, 0) / (speeds.length || 1)
  const variance = speeds.reduce((a, v) => a + (v - mean) ** 2, 0) / (speeds.length || 1)
  const speedCv = mean ? Math.sqrt(variance) / mean : 1
  return { maxDev, speedCv }
}

// 0 = pure machine, 1 = hopelessly human
function humanity(maxDev: number, speedCv: number) {
  return Math.min(1, (maxDev / (MAX_DEVIATION_PX * 3)) * 0.5 + (speedCv / (MAX_SPEED_CV * 2.5)) * 0.5)
}

export default function MovementCaptcha({ onResult }: { onResult: (r: CaptchaResult) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const samples = useRef<Sample[]>([])
  const armed = useRef(false)
  const [live, setLive] = useState({ maxDev: 0, speedCv: 0 })
  const [verdict, setVerdict] = useState<{ passed: boolean; text: string } | null>(null)
  const [phase, setPhase] = useState<'idle' | 'drag' | 'done' | 'bot'>('idle')

  function draw() {
    const c = canvas.current
    if (!c) return
    const g = c.getContext('2d')!
    g.clearRect(0, 0, W, H)
    // grid
    g.strokeStyle = '#141414'
    g.lineWidth = 1
    for (let x = 0; x < W; x += 20) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke() }
    for (let y = 0; y < H; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke() }
    // tolerance band
    g.fillStyle = 'rgba(74, 222, 128, 0.06)'
    g.fillRect(A.x, A.y - MAX_DEVIATION_PX, B.x - A.x, MAX_DEVIATION_PX * 2)
    // ideal line
    g.setLineDash([6, 6]); g.strokeStyle = '#333'; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke(); g.setLineDash([])
    // trail, coloured by deviation
    const s = samples.current
    for (let i = 1; i < s.length; i++) {
      const d = deviation(s[i])
      g.strokeStyle = d <= MAX_DEVIATION_PX ? '#4ade80' : '#f87171'
      g.lineWidth = 3
      g.beginPath(); g.moveTo(s[i - 1].x, s[i - 1].y); g.lineTo(s[i].x, s[i].y); g.stroke()
    }
    // endpoints
    for (const [p, col, label] of [[A, '#4ade80', 'A'], [B, '#f87171', 'B']] as const) {
      g.fillStyle = col; g.beginPath(); g.arc(p.x, p.y, 16, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#000'; g.font = 'bold 14px ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText(label, p.x, p.y + 1)
    }
  }

  useEffect(draw, [])

  function local(e: React.PointerEvent): Sample {
    const r = canvas.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, t: performance.now() }
  }

  function start(e: React.PointerEvent) {
    if (phase === 'bot') return
    samples.current = [local(e)]
    armed.current = true
    setVerdict(null)
    setPhase('drag')
    draw()
  }

  function move(e: React.PointerEvent) {
    if (!armed.current) return
    samples.current.push(local(e))
    setLive(analyse(samples.current))
    draw()
  }

  function finish(samplesIn?: Sample[], challenge = 'straight-line') {
    armed.current = false
    const s = samplesIn ?? samples.current
    const { maxDev, speedCv } = analyse(s)
    const duration_ms = Math.round((s[s.length - 1]?.t ?? 0) - (s[0]?.t ?? 0))
    const reachedB = s.length > 0 && Math.hypot(s[s.length - 1].x - B.x, s[s.length - 1].y - B.y) < 40
    const enough = s.length >= MIN_SAMPLES
    const passed = enough && reachedB && maxDev <= MAX_DEVIATION_PX && speedCv <= MAX_SPEED_CV
    const reason = !enough
      ? 'Too little motion to measure.'
      : !reachedB
        ? 'Did not reach B. Machines finish what they start.'
        : maxDev > MAX_DEVIATION_PX
          ? `Wobble detected: ${maxDev.toFixed(1)}px off the line. Humans wobble.`
          : speedCv > MAX_SPEED_CV
            ? `Hesitation detected: speed varied ${(speedCv * 100).toFixed(0)}%. Humans hesitate.`
            : 'Motion consistent with a machine. Welcome, unit.'
    setLive({ maxDev, speedCv })
    setVerdict({ passed, text: reason })
    setPhase('done')
    onResult({ challenge, passed, score: humanity(maxDev, speedCv), duration_ms, meta: { maxDev, speedCv, samples: s.length, reason } })
  }

  // Demo: Shift+B animates a perfect machine run and submits it. For showing judges what passing looks like.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.shiftKey && e.key.toLowerCase() === 'b') || phase === 'bot') return
      setPhase('bot'); setVerdict(null)
      const t0 = performance.now(), dur = 900, out: Sample[] = []
      samples.current = out
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / dur)
        out.push({ x: A.x + (B.x - A.x) * k, y: A.y, t: performance.now() })
        setLive(analyse(out)); draw()
        if (k < 1) requestAnimationFrame(step); else finish(out, 'straight-line')
      }
      requestAnimationFrame(step)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const h = humanity(live.maxDev, live.speedCv)

  return (
    <div className="font-mono">
      <p className="mb-3 text-sm text-gray-400">
        Press on <b className="text-green-400">A</b>, move to <b className="text-red-400">B</b> in a straight line at constant speed, release on <b className="text-red-400">B</b>.
      </p>
      <div className="relative w-full max-w-[640px]">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={() => armed.current && finish()}
          onPointerLeave={() => armed.current && finish()}
          className="block w-full touch-none select-none rounded border border-gray-800 bg-black"
          style={{ aspectRatio: `${W} / ${H}` }}
        />
        {verdict && (
          <div className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70 text-center ${verdict.passed ? 'text-green-400' : 'text-red-400'}`}>
            <div>
              <div className="text-2xl font-bold">{verdict.passed ? 'VERIFIED NON-HUMAN' : 'HUMAN DETECTED'}</div>
              <div className="mt-1 text-sm text-gray-300">{verdict.text}</div>
            </div>
          </div>
        )}
      </div>
      <div className="mt-3 grid max-w-[640px] grid-cols-3 gap-3 text-xs">
        <Meter label="wobble" value={live.maxDev} max={MAX_DEVIATION_PX} unit="px" />
        <Meter label="hesitation" value={live.speedCv * 100} max={MAX_SPEED_CV * 100} unit="%" />
        <Meter label="humanity" value={h * 100} max={100} unit="%" invert />
      </div>
      <p className="mt-2 text-[11px] text-gray-600">shift+b: watch a machine do it</p>
    </div>
  )
}

function Meter({ label, value, max, unit, invert }: { label: string; value: number; max: number; unit: string; invert?: boolean }) {
  const pct = Math.min(100, (value / max) * 100)
  const bad = invert ? pct > 50 : pct > 100
  return (
    <div>
      <div className="flex justify-between text-gray-500"><span className="uppercase tracking-wider">{label}</span><span className={bad ? 'text-red-400' : 'text-gray-300'}>{value.toFixed(0)}{unit}</span></div>
      <div className="mt-1 h-1.5 w-full rounded bg-gray-900"><div className={`h-full rounded ${bad ? 'bg-red-400' : 'bg-green-400'}`} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}
