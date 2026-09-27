'use client'
import { useEffect, useRef } from 'react'
import { useSurvivalGame } from './GameProvider'

export default function GameOver() {
  const { state, start, starting, saveState, saveResult, openLeaderboard } = useSurvivalGame()
  const heading = useRef<HTMLHeadingElement>(null)
  const result = state.terminal
  useEffect(() => { if (result) heading.current?.focus() }, [result])
  if (!result) return null
  return <section className="survival-result" aria-labelledby="survival-result-title">
    <h2 id="survival-result-title" ref={heading} tabIndex={-1}>{result.status === 'interrupted' ? 'Run interrupted' : 'Human detected'}</h2>
    <p role="status">{saveState.status === 'saved' ? saveState.receipt.ranked ? 'Saved · eligible for survival rankings' : 'Saved · unranked' : saveState.status === 'saving' ? 'Saving result…' : 'Local result · unsaved · unranked'}</p>
    <p>{(result.activeMs / 1000).toFixed(1)} seconds · {result.stage} · {result.inputMode} · {result.completedObjectiveIds.length} objectives</p>
    {result.status === 'failed' && <p><strong>Cause: {result.primaryReason}</strong></p>}
    {result.status === 'failed' && result.measurements.map(item => <p key={item.reason}><strong>{item.reason}</strong>: {item.explanation} ({item.value.toFixed(3)} / {item.threshold} {item.unit})</p>)}
    {result.status === 'failed' && result.pointerTrace && <figure><svg viewBox="0 0 100 100" width="200" height="200" role="img" aria-label="Actual failing pointer trace, normalized to its viewport"><polyline points={result.pointerTrace.map(p => `${p.x * 100},${p.y * 100}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="1" /></svg><figcaption>Actual failing pointer trace · viewport normalized</figcaption></figure>}
    {result.status === 'interrupted' && <p>Reloading or closing ends a run without a scored failure.</p>}
    <p>Gameplay submissions are stopped. Read the feed, browse rankings or start another run.</p>
    <p className="fine-print">Behavior is measured by your browser. Device thresholds are experimental.</p>
    {saveState.status === 'not_sent' && <button onClick={saveResult}>Save result</button>}
    {saveState.status === 'save_error' && <p role="alert">{saveState.message} {saveState.retryable ? <button onClick={saveResult}>Retry saving</button> : 'This result remains local. The server rejected it.'}</p>}
    {(saveState.status === 'saving' || saveState.status === 'save_error' && saveState.retryable) && <p>Keep this session open to reconcile saving. Reload or a new run discards the local retry payload; an in-flight save may still finish.</p>}
    <button onClick={openLeaderboard}>Leaderboard</button>
    <button disabled={starting} onClick={() => start(result.inputMode)}>Start another run</button>
  </section>
}
