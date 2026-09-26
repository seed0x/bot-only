'use client'
import { useState } from 'react'
import type { SurvivalInputMode } from '@/lib/types'
import { survivalIdleWarning } from '@/lib/survival/engine'
import { SURVIVAL_STAGES, survivalStageAt } from '@/lib/survival/config'
import { useSurvivalGame } from './GameProvider'

export default function GameHud() {
  const { state, readings, storageError, start, resume } = useSurvivalGame()
  const [mode, setMode] = useState<SurvivalInputMode>('pointer')
  const stage = survivalStageAt(state.activeMs)
  const next = SURVIVAL_STAGES.find(s => s.startsAtMs > state.activeMs)
  return <aside className="survival-hud" aria-label="Survival diagnostic">
    <strong>Local diagnostic · unranked</strong>
    <span role="status">{state.phase === 'ready' ? 'Not started — monitoring is off' : state.phase === 'ended' ? 'Run ended — see result below' : state.phase === 'running' ? 'Monitoring active' : state.phase === 'paused' ? 'Monitoring paused' : 'Preparing to monitor'}</span>
    {state.phase === 'ready' ? <>
      <p>Keep moving, type evenly and scroll consistently. Idle or repeated irregular windows end this local test. Scroll inertia counts. Objectives and saving arrive later.</p>
      <label>Input mode <select value={mode} onChange={e => setMode(e.target.value as SurvivalInputMode)}><option value="pointer">Mouse / pen</option><option value="touch_or_keyboard">Touch / keyboard</option></select></label>
      <button onClick={() => start(mode)}>Start local diagnostic</button>
    </> : <>
      <span>{(state.activeMs / 1000).toFixed(1)}s · {stage.id} · {state.run?.inputMode}</span>
      <span>Typing minimum: {stage.typingMinWpm} WPM</span>
      <span>Idle: {Math.max(0, stage.idleLimitMs - state.idleElapsedMs) / 1000}s remaining</span>
      {next && <small>At {next.startsAtMs / 1000}s: idle limit {next.idleLimitMs / 1000}s, typing minimum {next.typingMinWpm} WPM</small>}
      {state.phase === 'countdown' && <p role="status">Get ready — three-second countdown</p>}
      {state.phase === 'paused' && <p role="status">Paused {state.pauseReasons.join(', ')}. <button disabled={state.pauseReasons.length > 0} onClick={resume}>Resume</button></p>}
      {state.phase === 'running' && (['pointer', 'typing', 'scroll'] as const).map(detector => state.badWindows[detector] > 0 && <p role="status" key={detector}><strong>{detector} warning:</strong> {state.badWindows[detector]} consecutive bad windows. A good window clears the count; failure occurs at the window’s stage limit. {readings[detector]?.explanation}</p>)}
      {survivalIdleWarning(state) && <p role="status">Idle warning: use a key, move or scroll before time expires.</p>}
      <details><summary>Sensor diagnostics / rules</summary>{(['pointer', 'typing', 'scroll'] as const).map(detector => <p key={detector}>{detector}: {readings[detector]?.outcome ?? 'No qualified data'} · {state.badWindows[detector]}/{stage.badWindowsToFail} bad windows. {readings[detector]?.explanation}</p>)}<p>Move in straight strokes. Type at even intervals. Scroll steadily; inertia is measured. These thresholds need real-device tuning.</p></details>
    </>}
    {storageError && <p role="alert">{storageError}</p>}
  </aside>
}
