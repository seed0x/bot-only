'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { clickRhythm, MAX_CORRECTIONS, MAX_GAP_MS, rhythmHumanity } from '@/lib/image-captcha'
import type { ImageClick, IssuedChallenge, Solution } from '@/lib/types'

// The player only. The server chose the rule and tiles, holds the answer, and scores the click log.
// The live meter uses the same rhythm function the server scores with, so what you see is what you get.
export default function ImageCaptcha({ challenge, onSolution, onRestart }: { challenge: IssuedChallenge; onSolution: (s: Solution) => void; onRestart: () => void }) {
  const tiles = challenge.tiles ?? []
  const windowMs = challenge.expiresAt - challenge.startedAt
  const [clicks, setClicks] = useState<ImageClick[]>([])
  const [loaded, setLoaded] = useState(0)
  const [broken, setBroken] = useState(false)
  const [sent, setSent] = useState(false)
  const [remaining, setRemaining] = useState(windowMs)
  const readyAt = useRef<number | null>(null)
  const deadline = useRef<number | null>(null)
  // Mirrors for the timer callback, which must see the latest values without re-subscribing.
  const clicksRef = useRef<ImageClick[]>([]), sentRef = useRef(false), submitRef = useRef(onSolution)
  useEffect(() => { submitRef.current = onSolution }, [onSolution])
  const ready = loaded >= tiles.length && !broken
  const expired = remaining <= 0

  useEffect(() => { if (ready && readyAt.current === null) readyAt.current = performance.now() }, [ready])
  useEffect(() => {
    if (deadline.current === null) deadline.current = performance.now() + windowMs
    const id = setInterval(() => {
      const left = Math.max(0, deadline.current! - performance.now())
      setRemaining(left)
      // Time runs out: submit what was clicked, so the verdict is recorded instead of silently lost.
      if (left === 0 && !sentRef.current && clicksRef.current.length > 0) {
        sentRef.current = true; setSent(true); submitRef.current({ clicks: clicksRef.current })
      }
      if (left === 0 || sentRef.current) clearInterval(id)
    }, 100)
    return () => clearInterval(id)
  }, [windowMs])

  const rhythm = clickRhythm(clicks)
  const selected = rhythm.selection
  const humanity = rhythmHumanity(rhythm)

  // `at` is the click event's timestamp: same clock as performance.now(), taken when the click happened.
  function toggle(id: string, at: number) {
    if (sent || !ready || expired || readyAt.current === null) return
    clicksRef.current = [...clicksRef.current, { id, t: Math.max(0, Math.round(at - readyAt.current)) }]
    setClicks(clicksRef.current)
  }
  function verify() {
    if (sentRef.current || selected.length === 0) return
    sentRef.current = true; setSent(true); onSolution({ clicks: clicksRef.current })
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
      <span>humanity <strong>{humanity.toFixed(2)}</strong></span>
      <span className={rhythm.corrections > MAX_CORRECTIONS ? 'is-bad' : ''}>changed mind {rhythm.corrections}</span>
      <span className={rhythm.maxGap > MAX_GAP_MS ? 'is-bad' : ''}>longest pause {(rhythm.maxGap / 1000).toFixed(1)}s</span>
      <i style={{ width: `${Math.round(humanity * 100)}%` }} aria-hidden />
    </div>
    <footer className="image-captcha-foot">
      <p className="fine-print" role="status">{broken ? 'An image failed to load.' : !ready ? 'Loading images…' : expired && clicks.length === 0 ? 'Time’s up.' : `${selected.length} selected`}</p>
      {expired && clicks.length === 0 || broken
        ? <button type="button" className="button-secondary" onClick={onRestart}>New round</button>
        : <button type="button" className="button-primary" onClick={verify} disabled={sent || !ready || selected.length === 0}>{sent ? 'Checking…' : 'Verify'}</button>}
    </footer>
  </div>
}
