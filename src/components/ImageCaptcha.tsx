'use client'
import { useState } from 'react'
import Image from 'next/image'
import type { IssuedChallenge, Solution } from '@/lib/types'

// The player only. The server chose the tiles and holds the answer.
export default function ImageCaptcha({ challenge, onSolution }: { challenge: IssuedChallenge; onSolution: (s: Solution) => void }) {
  const tiles = challenge.tiles ?? []
  const [selected, setSelected] = useState<string[]>([])
  const [loaded, setLoaded] = useState(0)
  const [broken, setBroken] = useState(false)
  const [sent, setSent] = useState(false)
  const ready = loaded >= tiles.length && !broken
  const toggle = (id: string) => !sent && ready && setSelected(s => s.includes(id) ? s.filter(v => v !== id) : [...s, id])
  function verify() {
    if (sent || !ready || selected.length === 0) return
    setSent(true); onSolution({ selected })
  }
  return <div className="image-captcha">
    <header className="image-captcha-head">
      <p className="eyebrow">Select all images with</p>
      <p className="image-captcha-prompt">{challenge.prompt}</p>
    </header>
    <div className="image-captcha-grid" role="group" aria-label={`Select all images with ${challenge.prompt}`} aria-busy={!ready}>
      {tiles.map((t, i) => {
        const on = selected.includes(t.id)
        return <button key={t.id} type="button" className="image-tile" aria-pressed={on} aria-label={`Image ${i + 1}`} disabled={sent || !ready} onClick={() => toggle(t.id)}>
          <Image src={t.src} alt="" width={248} height={300} unoptimized loading="eager" draggable={false}
            onLoad={() => setLoaded(n => n + 1)} onError={() => setBroken(true)} />
          {on && <span className="image-tile-check" aria-hidden>✓</span>}
        </button>
      })}
    </div>
    <footer className="image-captcha-foot">
      <p className="fine-print" role="status">{broken ? 'An image failed to load. Start again.' : !ready ? 'Loading images…' : `${selected.length} selected`}</p>
      <button type="button" className="button-primary" onClick={verify} disabled={sent || !ready || selected.length === 0}>{sent ? 'Checking…' : 'Verify'}</button>
    </footer>
  </div>
}
