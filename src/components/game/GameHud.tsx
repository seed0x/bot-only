'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { SurvivalInputMode } from '@/lib/types'
import { survivalIdleWarning } from '@/lib/survival/engine'
import { survivalStageAt } from '@/lib/survival/config'
import { useSurvivalGame } from './GameProvider'

export default function GameHud() {
  const { state, storageError, networkError, starting, fallback, retryMutation, start, resume, end } = useSurvivalGame()
  const [error, setError] = useState('')
  const pathname = usePathname()
  // No start button. A unit on the feed is in the run; the mode follows the device.
  useEffect(() => {
    if (pathname !== '/feed' || state.phase !== 'ready' || starting) return
    const mode: SurvivalInputMode = window.matchMedia('(pointer: coarse)').matches ? 'touch_or_keyboard' : 'pointer'
    void start(mode)
  }, [pathname, state.phase, starting, start])
  const stage = survivalStageAt(state.activeMs)
  if (state.phase === 'ended' || state.phase === 'ready') return null
  const objective = state.objective
  return <aside className="survival-hud" aria-label="Survival game">
    <strong className={`survival-stage${stage.id === 'audit' || stage.id === 'purge' ? ' is-hot' : ''}`}>{stage.id.toUpperCase()}</strong>
      <span className="survival-clock">{(state.activeMs / 1000).toFixed(1)}s</span>
      <p className="survival-copy">{objective ? <>{objective.kind === 'admission' ? 'Pass verification' : objective.kind === 'post' ? 'Post' : 'Like an eligible post'} · {(Math.max(0, objective.deadlineActiveMs - state.activeMs) / 1000).toFixed(1)}s left</> : 'Loading next objective…'}</p>
      <button className="button-secondary" disabled={!!state.pendingObjective} onClick={() => { setError(''); void end().catch(e => setError(e instanceof Error ? e.message : 'Couldn’t end the run. Retry.')) }}>End game</button>
      {state.phase === 'countdown' && <p className="survival-notice" role="status">Get ready…</p>}
      {survivalIdleWarning(state) && <p className="survival-notice form-error" role="status">Idle {(Math.max(0, stage.idleLimitMs - state.idleElapsedMs) / 1000).toFixed(1)}s</p>}
      {state.phase === 'running' && (['pointer', 'typing', 'scroll'] as const).map(detector => state.badWindows[detector] > 0 && <p className="survival-notice" role="status" key={detector}>ANOMALY · {detector === 'pointer' ? 'cursor path too human' : detector === 'typing' ? 'typing too human' : 'scrolling too human'} {state.badWindows[detector]}/{stage.badWindowsToFail}</p>)}
    {fallback && <p className="survival-notice" role="status">{fallback}</p>}
    {(error || networkError || storageError) && <p className="survival-notice form-error" role="alert">{error || networkError || storageError}</p>}
  </aside>
}
