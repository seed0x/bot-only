'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { clickRhythm } from '@/lib/image-captcha'
import { newPointerMonitor, observePointer } from '@/lib/pointer-metrics'
import { CAPTCHA_STAGE, MAX_CORRECTIONS, pointerReport } from '@/lib/captcha-verdict'
import { collected, interrupt, newPointerCollector, observe } from '@/lib/survival/pointer-collector'
import type { ImageClick, IssuedChallenge, Solution, SurvivalPointerSample } from '@/lib/types'

// The player. The server chose the tiles, holds the answer, and judges the whole attempt by the
// survival game's opening-stage rules: tiles, click rhythm, idle time and mouse straightness.
// The meter below the grid runs the same pointer detector, so what you see is what the server sees.
export default function ImageCaptcha({ challenge, onSolution, onRestart }: { challenge: IssuedChallenge; onSolution: (s: Solution) => void; onRestart: () => void }) {
  const tiles = challenge.tiles ?? []
  const windowMs = challenge.expiresAt - challenge.startedAt
  const [clicks, setClicks] = useState<ImageClick[]>([])
  const [loaded, setLoaded] = useState(0)
  const [broken, setBroken] = useState(false)
  const [sent, setSent] = useState(false)
  const [remaining, setRemaining] = useState(windowMs)
  const [strokes, setStrokes] = useState<SurvivalPointerSample[][]>([])
  const [idleMs, setIdleMs] = useState(0)
  const pointer = useRef(newPointerMonitor())
  const collector = useRef(newPointerCollector())
  const viewport = useRef<{ width: number; height: number } | null>(null)
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number } | null>(null)
  const lastAction = useRef<number | null>(null)
  const readyAt = useRef<number | null>(null)
  const deadline = useRef<number | null>(null)
  // Mirrors for the timer callback, which must see the latest values without re-subscribing.
  const clicksRef = useRef<ImageClick[]>([]), sentRef = useRef(false), submitRef = useRef(onSolution)
  useEffect(() => { submitRef.current = onSolution }, [onSolution])
  const ready = loaded >= tiles.length && !broken
  const expired = remaining <= 0

  const solution = (): Solution => {
    const s = collected(collector.current)
    return {
      clicks: clicksRef.current,
      ...(pointer.current.metrics.samples > 0 ? { pointer: pointer.current.metrics } : {}),
      ...(viewport.current && s.length ? { strokes: s.map(st => st.map(p => ({ x: p.x, y: p.y, t: Math.round(p.t - (readyAt.current ?? 0)) }))), viewport: viewport.current } : {}),
    }
  }

  useEffect(() => {
    if (!ready || sent || expired) return
    const cut = () => { pointer.current = { ...pointer.current, last: null }; interrupt(collector.current) }
    const move = (event: PointerEvent) => {
      if (document.hidden || !document.hasFocus() || (event.pointerType !== 'mouse' && event.pointerType !== 'pen')) return
      if (readyAt.current === null) return
      if (!viewport.current) { viewport.current = { width: window.innerWidth, height: window.innerHeight }; setViewportSize(viewport.current) }
      const x = Math.min(Math.max(0, event.clientX), viewport.current.width), y = Math.min(Math.max(0, event.clientY), viewport.current.height)
      const t = event.timeStamp
      pointer.current = observePointer(pointer.current, { x, y, t })
      observe(collector.current, { x, y, t })
    }
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', cut, { passive: true })
    window.addEventListener('pointerup', cut, { passive: true })
    window.addEventListener('scroll', cut, { passive: true })
    window.addEventListener('blur', cut)
    window.addEventListener('resize', cut)
    document.addEventListener('visibilitychange', cut)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', cut); window.removeEventListener('pointerup', cut)
      window.removeEventListener('scroll', cut)
      window.removeEventListener('blur', cut); window.removeEventListener('resize', cut)
      document.removeEventListener('visibilitychange', cut)
    }
  }, [ready, sent, expired])

  useEffect(() => { if (ready && readyAt.current === null) { readyAt.current = performance.now(); lastAction.current = readyAt.current } }, [ready])
  useEffect(() => {
    if (deadline.current === null) deadline.current = performance.now() + windowMs
    const id = setInterval(() => {
      const now = performance.now(), left = Math.max(0, deadline.current! - now)
      setRemaining(left)
      setStrokes(collected(collector.current))
      if (lastAction.current !== null) setIdleMs(now - lastAction.current)
      // Time runs out: submit what was clicked, so the verdict is recorded instead of silently lost.
      if (left === 0 && !sentRef.current && clicksRef.current.length > 0) { sentRef.current = true; setSent(true); submitRef.current(solution()) }
      if (left === 0 || sentRef.current) clearInterval(id)
    }, 100)
    return () => clearInterval(id)
  }, [windowMs])

  const rhythm = clickRhythm(clicks)
  const selected = rhythm.selection
  const motion = pointerReport(viewportSize ? strokes : [], viewportSize ?? { width: 1, height: 1 })
  const idleLimit = CAPTCHA_STAGE.idleLimitMs, idleWarn = idleMs >= idleLimit * 0.75

  // `at` is the click event's timestamp: same clock as performance.now(), taken when the click happened.
  function toggle(id: string, at: number) {
    if (sent || !ready || expired || readyAt.current === null) return
    clicksRef.current = [...clicksRef.current, { id, t: Math.max(0, Math.round(at - readyAt.current)) }]
    lastAction.current = at
    setClicks(clicksRef.current)
  }
  function verify() {
    if (sentRef.current || selected.length === 0) return
    sentRef.current = true; setSent(true); onSolution(solution())
  }
  const seconds = Math.ceil(remaining / 1000)
  return <div className="image-captcha">
    <header className="image-captcha-head">
      <div className="image-captcha-rule">
        <p className="eyebrow">{challenge.instruction}</p>
        <p className="image-captcha-prompt">{challenge.prompt}</p>
      </div>
      <p className={`image-captcha-timer${seconds <= 5 ? ' is-low' : ''}`} aria-label={`${seconds} seconds left`}>{seconds}s</p>
    </header>
    <div className="image-captcha-grid" role="group" aria-label={`${challenge.instruction} ${challenge.prompt}`} aria-busy={!ready}>
      {tiles.map((t, i) => {
        const at = selected.indexOf(t.id)
        return <button key={t.id} type="button" className="image-tile" aria-pressed={at >= 0} aria-label={`Image ${i + 1}`} disabled={sent || !ready || expired} onClick={e => toggle(t.id, e.timeStamp)}>
          <Image src={t.src} alt="" width={248} height={300} unoptimized loading="eager" draggable={false}
            onLoad={() => setLoaded(n => n + 1)} onError={() => setBroken(true)} />
          {at >= 0 && <span className="image-tile-check" aria-hidden>{challenge.ordered ? at + 1 : '✓'}</span>}
        </button>
      })}
    </div>
    <div className="image-captcha-meter" aria-live="off">
      <span className={motion.bad >= motion.limit ? 'is-bad' : motion.bad > 0 ? 'is-warn' : ''}>Curved strokes <strong>{motion.bad}</strong>/{motion.limit}</span>
      <span>Straightness <strong>{motion.scored ? motion.worst.toFixed(2) : '—'}</strong>/{motion.threshold}</span>
      <span className={rhythm.corrections > MAX_CORRECTIONS ? 'is-bad' : ''}>Corrections <strong>{rhythm.corrections}</strong>/{MAX_CORRECTIONS}</span>
      <span className={idleMs >= idleLimit ? 'is-bad' : idleWarn ? 'is-warn' : ''}>Idle <strong>{(idleMs / 1000).toFixed(1)}s</strong>/{idleLimit / 1000}s</span>
    </div>
    <footer className="image-captcha-foot">
      <p className="fine-print" role="status">{broken ? 'An image failed to load.' : !ready ? 'Loading images…' : expired && clicks.length === 0 ? 'Time’s up.' : idleWarn && !sent ? 'Machines don’t hesitate.' : `${selected.length} selected`}</p>
      {expired && clicks.length === 0 || broken
        ? <button type="button" className="button-secondary" onClick={onRestart}>New round</button>
        : <button type="button" className="button-primary" onClick={verify} disabled={sent || !ready || selected.length === 0}>{sent ? 'Checking…' : 'Verify'}</button>}
    </footer>
  </div>
}
