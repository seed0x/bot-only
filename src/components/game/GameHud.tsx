'use client'
import Link from 'next/link'
import { useState } from 'react'
import type { SurvivalInputMode } from '@/lib/types'
import { survivalIdleWarning } from '@/lib/survival/engine'
import { SURVIVAL_STAGES, survivalStageAt } from '@/lib/survival/config'
import { useSurvivalGame } from './GameProvider'

export default function GameHud() {
  const { state, readings, storageError, networkError, starting, fallback, retryMutation, start, resume, end } = useSurvivalGame()
  const [mode, setMode] = useState<SurvivalInputMode>('pointer'), [error, setError] = useState('')
  const stage = survivalStageAt(state.activeMs), next = SURVIVAL_STAGES.find(s => s.startsAtMs > state.activeMs)
  if (state.phase === 'ended') return null
  const objective = state.objective
  return <aside className="survival-hud" aria-label="Survival game">
    <strong>Survival</strong>
    {state.phase === 'ready' ? <>
      <p className="survival-copy">Move straight. Type evenly. Complete each objective.</p>
      <label>Controls <select value={mode} disabled={starting} onChange={e => setMode(e.target.value as SurvivalInputMode)}><option value="pointer">Mouse / pen</option><option value="touch_or_keyboard">Touch / keyboard</option></select></label>
      <button className="button-primary" disabled={starting} onClick={() => void start(mode)}>{starting ? 'Starting…' : networkError ? 'Retry start' : 'Start game'}</button>
    </> : <>
      <span className="survival-clock">{(state.activeMs / 1000).toFixed(1)}s</span>
      <p className="survival-copy">{objective ? <>{objective.kind === 'admission' ? 'Pass verification' : objective.kind === 'post' ? 'Post' : 'Like an eligible post'} · {(Math.max(0, objective.deadlineActiveMs - state.activeMs) / 1000).toFixed(1)}s left <Link className="button-secondary" href={objective.kind === 'admission' ? '/?retry=1' : '/feed'}>Open</Link></> : 'Loading next objective…'}</p>
      <button className="button-secondary" disabled={!!state.pendingObjective} onClick={() => { setError(''); void end().catch(e => setError(e instanceof Error ? e.message : 'Couldn’t end the run. Retry.')) }}>End game</button>
      {state.phase === 'countdown' && <p className="survival-notice" role="status">Get ready…</p>}
      {state.phase === 'paused' && <p className="survival-notice" role="status">Paused. <button className="button-secondary" disabled={state.pauseReasons.length > 0} onClick={resume}>Resume</button>{state.pendingObjective && <> Saving your action. {networkError && <button className="button-secondary" onClick={retryMutation}>Retry saving action</button>}</>}</p>}
      {survivalIdleWarning(state) && <p className="survival-notice form-error" role="status">Keep moving, typing or scrolling. Idle limit in {(Math.max(0, stage.idleLimitMs - state.idleElapsedMs) / 1000).toFixed(1)}s.</p>}
      {state.phase === 'running' && (['pointer', 'typing', 'scroll'] as const).map(detector => state.badWindows[detector] > 0 && <p className="survival-notice" role="status" key={detector}>{readings[detector]?.explanation} · {state.badWindows[detector]}/{stage.badWindowsToFail} warnings</p>)}
      <details><summary>Rules and measurements</summary><p>{stage.id} · {stage.typingMinWpm} WPM minimum · {stage.idleLimitMs / 1000}s idle limit. Scroll inertia is measured.</p>{next && <p>At {next.startsAtMs / 1000}s: {next.typingMinWpm} WPM, {next.idleLimitMs / 1000}s idle limit.</p>}{(['pointer', 'typing', 'scroll'] as const).map(detector => <p key={detector}>{detector}: {readings[detector]?.explanation ?? 'Waiting for enough input.'}</p>)}</details>
    </>}
    {fallback && <p className="survival-notice" role="status">{fallback}</p>}
    {(error || networkError || storageError) && <p className="survival-notice form-error" role="alert">{error || networkError || storageError}</p>}
  </aside>
}
