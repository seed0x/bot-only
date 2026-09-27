'use client'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSurvivalGame } from './GameProvider'

// The run ended. The verdict, the numbers, and the way to the rankings.
export default function GameOver() {
  const { state, start } = useSurvivalGame()
  const heading = useRef<HTMLHeadingElement>(null)
  const result = state.terminal
  useEffect(() => { if (result) heading.current?.focus() }, [result])
  if (!result) return null
  return <section className="survival-result" aria-labelledby="survival-result-title" role="alert">
    <p className="eyebrow">{result.status === 'interrupted' ? 'Run interrupted' : 'Human detected'}</p>
    <h2 id="survival-result-title" ref={heading} tabIndex={-1}>{result.status === 'interrupted' ? 'Run over' : 'Designation revoked'}</h2>
    <p className="survival-numbers">{(result.activeMs / 1000).toFixed(1)}s · {result.stage} · {result.completedObjectiveIds.length} objectives</p>
    {result.status === 'failed' && <ul className="survival-measurements">{result.measurements.map(item => <li key={item.reason}><strong>{item.reason.replace('_', ' ')}</strong><span>{item.explanation}</span></li>)}</ul>}
    <div className="receipt-actions"><Link className="button-primary" href="/leaderboard">Leaderboard</Link><button className="button-secondary" onClick={() => start(result.inputMode)}>Run again</button></div>
  </section>
}
