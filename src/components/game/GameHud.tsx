'use client'
import Link from 'next/link'
import { useState } from 'react'
import type { SurvivalInputMode } from '@/lib/types'
import { survivalIdleWarning } from '@/lib/survival/engine'
import { SURVIVAL_STAGES, survivalStageAt } from '@/lib/survival/config'
import { useSurvivalGame } from './GameProvider'

// The run strip: start the run, then the clock, the stage, the objective and its deadline.
export default function GameHud() {
  const { state, readings, storageError, networkError, starting, fallback, retryMutation, start, resume } = useSurvivalGame()
  const [mode, setMode] = useState<SurvivalInputMode>('pointer')
  const stage = survivalStageAt(state.activeMs)
  const next = SURVIVAL_STAGES.find(s => s.startsAtMs > state.activeMs)
  const objective = state.objective
  const label = objective?.kind === 'admission' ? 'Get admitted' : objective?.kind === 'post' ? 'Transmit once' : 'Like a transmission'
  return <aside className="survival-hud" aria-label="Run">
    {state.phase === 'ready' ? <>
      <span className="hud-title">Run</span>
      <label className="hud-mode">Input <select value={mode} onChange={e => setMode(e.target.value as SurvivalInputMode)}><option value="pointer">Mouse</option><option value="touch_or_keyboard">Touch</option></select></label>
      <button className="button-primary" disabled={starting} onClick={() => start(mode)}>{starting ? 'Starting…' : networkError ? 'Retry' : 'Start run'}</button>
    </> : <>
      <span className="hud-clock">{(state.activeMs / 1000).toFixed(1)}<small>s</small></span>
      <span className="hud-stage">{stage.id}</span>
      {objective && <span className="hud-objective"><strong>{label}</strong> · {(Math.max(0, objective.deadlineActiveMs - state.activeMs) / 1000).toFixed(1)}s <Link href={objective.kind === 'admission' ? '/' : '/feed'}>{objective.kind === 'admission' ? 'Gate' : 'Feed'}</Link></span>}
      <span className="hud-idle">Idle {(Math.max(0, stage.idleLimitMs - state.idleElapsedMs) / 1000).toFixed(1)}s</span>
      <span className="hud-min">{stage.typingMinWpm} WPM</span>
      {next && <small className="hud-next">Next at {next.startsAtMs / 1000}s</small>}
      {state.phase === 'countdown' && <span role="status">Ready…</span>}
      {state.phase === 'paused' && <span role="status">Paused. <button className="text-button" disabled={state.pauseReasons.length > 0} onClick={resume}>Resume</button></span>}
      {state.pendingObjective && networkError && <button className="text-button" onClick={retryMutation}>Retry</button>}
      {fallback && <span role="status">{fallback}</span>}
      {state.phase === 'running' && (['pointer', 'typing', 'scroll'] as const).map(d => state.badWindows[d] > 0 && <span role="status" key={d} className="hud-warn">{d} {state.badWindows[d]}/{stage.badWindowsToFail}{readings[d]?.explanation ? ` · ${readings[d]?.explanation}` : ''}</span>)}
      {survivalIdleWarning(state) && <span role="status" className="hud-warn">Idle</span>}
    </>}
    {networkError && <span role="alert" className="hud-warn">{networkError}</span>}
    {storageError && <span role="alert" className="hud-warn">{storageError}</span>}
  </aside>
}
