'use client'
import { useEffect, useRef } from 'react'
import { useSurvivalGame } from './GameProvider'

export default function GameOver() {
  const { state, start } = useSurvivalGame()
  const heading = useRef<HTMLHeadingElement>(null)
  const result = state.terminal
  useEffect(() => { if (result) heading.current?.focus() }, [result])
  if (!result) return null
  return <section className="survival-result" aria-labelledby="survival-result-title">
    <h2 id="survival-result-title" ref={heading} tabIndex={-1}>{result.status === 'interrupted' ? 'Run interrupted' : 'Human detected'}</h2>
    <p>Local result · unsaved · unranked</p>
    <p>{(result.activeMs / 1000).toFixed(1)} seconds · {result.stage} · {result.inputMode} · {result.completedObjectiveIds.length} objectives</p>
    {result.status === 'failed' && result.measurements.map(item => <p key={item.reason}><strong>{item.reason}</strong>: {item.explanation} ({item.value.toFixed(3)} / {item.threshold} {item.unit})</p>)}
    {result.status === 'interrupted' && <p>Reloading or closing ends a run without a scored failure.</p>}
    <p>Saving and objective enforcement are not integrated yet. Existing network actions remain available in this diagnostic increment.</p>
    <button onClick={() => start(result.inputMode)}>Start another local run</button>
  </section>
}
