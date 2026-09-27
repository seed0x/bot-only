'use client'
import { returnToGate } from '@/lib/navigation'
import { useEffect, useState } from 'react'
import EndScreen from '@/components/EndScreen'
import { useSurvivalGame } from './GameProvider'

export default function GameOver() {
  const { state, saveState, saveError, saveResult, restart } = useSurvivalGame()
  const [restarting, setRestarting] = useState(false)
  const result = state.terminal
  // A failed run also ends the admission: the designation is gone with it.
  useEffect(() => { if (result?.status === 'failed') void fetch('/api/session/end', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => {}) }, [result?.status])
  if (!result) return null
  async function again(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (restarting) return
    setRestarting(true)
    // Whatever the save or the clear did, the gate always opens: it forgets everything anyway.
    try { await restart() } catch { /* the gate resets the session */ }
    returnToGate()
  }
  return <EndScreen eyebrow={state.user ? `@${state.user.handle}` : 'onlybots'} title={result.status === 'interrupted' ? 'Run ended.' : 'Human detected.'} failed={result.status === 'failed'}
    detail={<>
      {result.status === 'failed' && <p className="muted">{result.measurements[0]?.explanation}</p>}
      <dl className="game-result-metrics">
        <div><dt>Time survived</dt><dd>{(result.activeMs / 1000).toFixed(2)}<small>s</small></dd></div>
        <div><dt>Objectives</dt><dd>{result.completedObjectiveIds.length}</dd></div>
      </dl>
      {saveError && <div role="alert"><p className="form-error">{saveError}</p><button className="button-secondary" onClick={() => void saveResult().catch(() => {})}>Retry saving</button></div>}
    </>}>
    <form action="/" onSubmit={again}><button className="button-primary" disabled={restarting}>{restarting ? 'Restarting…' : 'Start again'}</button></form>
  </EndScreen>
}
