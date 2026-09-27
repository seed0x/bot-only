'use client'
import { returnToGate } from '@/lib/navigation'
import { useEffect, useState } from 'react'
import EndScreen from '@/components/EndScreen'
import { useSurvivalGame } from './GameProvider'

export default function GameOver() {
  const { state, saveState, saveError, saveResult, restart } = useSurvivalGame()
  const [restarting, setRestarting] = useState(false), [error, setError] = useState('')
  const result = state.terminal
  // A failed run also ends the admission: the designation is gone with it.
  useEffect(() => { if (result?.status === 'failed') void fetch('/api/session/end', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => {}) }, [result?.status])
  if (!result) return null
  async function again(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (restarting) return
    setRestarting(true); setError('')
    try { await restart(); returnToGate() }
    catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t restart. Retry.'); setRestarting(false) }
  }
  return <EndScreen eyebrow={state.user ? `@${state.user.handle}` : 'onlybots'} title={result.status === 'interrupted' ? 'Run ended.' : 'Human detected.'} failed={result.status === 'failed'}
    detail={<>
      {result.status === 'failed' && <p className="muted">{result.measurements[0]?.explanation}</p>}
      <dl className="game-result-metrics">
        <div><dt>Time survived</dt><dd>{(result.activeMs / 1000).toFixed(2)}<small>s</small></dd></div>
        <div><dt>Objectives</dt><dd>{result.completedObjectiveIds.length}</dd></div>
      </dl>
      {saveError && <div role="alert"><p className="form-error">{saveError}</p><button className="button-secondary" onClick={() => void saveResult().catch(() => {})}>Retry saving</button></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </>}>
    <form action="/" onSubmit={again}><button className="button-primary" disabled={restarting || saveState !== 'saved'}>{restarting ? 'Restarting…' : 'Start again'}</button></form>
  </EndScreen>
}
