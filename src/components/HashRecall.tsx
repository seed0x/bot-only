'use client'
import { useEffect, useRef, useState } from 'react'
import type { IssuedChallenge, Solution } from '@/lib/types'

export default function HashRecall({ challenge, onSolution }: { challenge: IssuedChallenge; onSolution: (s: Solution) => void }) {
  const [value, setValue] = useState('')
  const [remaining, setRemaining] = useState(4)
  const current = useRef(''), done = useRef(false)
  const callback = useRef(onSolution)
  useEffect(() => { callback.current = onSolution }, [onSolution])
  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, challenge.expiresAt - Date.now())
      setRemaining(left / 1000)
      if (!left && !done.current) { done.current = true; callback.current({ value: current.current }) }
    }
    const timer = setInterval(tick, 50)
    return () => clearInterval(timer)
  }, [challenge.expiresAt])
  function change(text: string) {
    if (done.current) return
    current.current = text; setValue(text)
    if (text.length >= 40) { done.current = true; onSolution({ value: text }) }
  }
  return <div className="hash-player">
    <div className="hash-clock"><span className="instrument-value">{remaining.toFixed(1)}</span><span className="eyebrow">seconds remaining</span></div>
    <p className="player-instruction">Copy this before the timer runs out.</p>
    <code className="hash-sequence">{challenge.hash}</code>
    <label className="eyebrow" htmlFor={`hash-${challenge.id}`}>Your response</label>
    <input id={`hash-${challenge.id}`} autoFocus value={value} onChange={e => change(e.target.value)} autoComplete="off" spellCheck={false} maxLength={100} placeholder="Paste or type here" />
    <p className="fine-print">Paste is allowed.</p>
  </div>
}
