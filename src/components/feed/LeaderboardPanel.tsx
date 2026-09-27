'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSurvivalGame } from '@/components/game/GameProvider'
import Avatar from './Avatar'
import { usePollingResource } from '@/hooks/usePollingResource'
import type { SurvivalInputMode, SurvivalScoresResponse } from '@/lib/types'
import { SURVIVAL_ID_PATTERN, SURVIVAL_RULES_VERSION, survivalStageAt } from '@/lib/survival/config'

export function isSurvivalScores(v: unknown, mode: SurvivalInputMode): v is SurvivalScoresResponse {
  if (!v || typeof v !== 'object') return false
  const data = v as Record<string, unknown>
  if (data.rulesVersion !== SURVIVAL_RULES_VERSION || data.inputMode !== mode || !Array.isArray(data.scores)) return false
  const handles = new Set<string>(), runs = new Set<string>()
  return data.scores.every(row => {
    if (!row || typeof row !== 'object') return false
    const r = row as Record<string, unknown>
    if (typeof r.runId !== 'string' || !SURVIVAL_ID_PATTERN.test(r.runId) || runs.has(r.runId) || typeof r.handle !== 'string' || !/^[a-z0-9_]{1,24}$/.test(r.handle) || r.handle === 'system' || handles.has(r.handle) ||
      typeof r.activeMs !== 'number' || !Number.isFinite(r.activeMs) || r.activeMs < 0 || r.activeMs > 86400000 || typeof r.completedObjectives !== 'number' || !Number.isSafeInteger(r.completedObjectives) || r.completedObjectives < 0 || r.completedObjectives > 6000 || r.roundsSurvived !== Math.floor(r.activeMs / 30000) || r.stage !== survivalStageAt(r.activeMs).id) return false
    runs.add(r.runId); handles.add(r.handle)
    return true
  })
}

export default function LeaderboardPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pause, state } = useSurvivalGame()
  const [mode, setMode] = useState<SurvivalInputMode>(state.run?.inputMode ?? 'pointer')
  const validate = useCallback((v: unknown): v is SurvivalScoresResponse => isSurvivalScores(v, mode), [mode])
  const dialog = useRef<HTMLDialogElement>(null)
  const { data, error, loading, refresh } = usePollingResource(open ? `/api/scores?inputMode=${mode}&rulesVersion=${SURVIVAL_RULES_VERSION}` : null, validate, 2000)
  useEffect(() => {
    if (!open) return
    pause('leaderboard', true)
    const previous = document.activeElement
    const el = dialog.current
    if (el && !el.open) el.showModal()
    return () => {
      el?.close()
      pause('leaderboard', false)
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [open, pause])
  return <dialog ref={dialog} className="leaderboard-panel is-holo" onCancel={e => { e.preventDefault(); onClose() }} onClose={() => { if (!dialog.current?.open) onClose() }} onClick={e => {
    if (e.target === dialog.current) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose() }
  }} aria-labelledby="leaderboard-title">
    <div className="panel-heading"><span className="eyebrow">Leaderboard</span><button className="button-icon" onClick={onClose} aria-label="Close leaderboard">×</button></div>
    <h2 id="leaderboard-title">Longest survival</h2>
    <p className="muted">Best confirmed failed run per unit · {SURVIVAL_RULES_VERSION}. Ordered by active time, then objectives. Anonymous and interrupted runs are unranked. Device thresholds are experimental.</p>
    <label>Input mode <select value={mode} onChange={e => setMode(e.target.value as SurvivalInputMode)}><option value="pointer">Mouse / pen</option><option value="touch_or_keyboard">Touch / keyboard</option></select></label>
    {loading && <p role="status">Loading rankings…</p>}
    {error && <p role="alert">{data ? 'Updates paused. Showing last confirmed rankings.' : 'Rankings unavailable.'} <button className="text-button" onClick={refresh}>Retry</button></p>}
    {data && <ol className="leaderboard-rows">{data.scores.map((r, i) => <li key={r.runId}>
      <span className="rank-number">{String(i + 1).padStart(2, '0')}</span><Avatar handle={r.handle} size={32} />
      <div className="rank-unit"><strong>@{r.handle}</strong><span className="eyebrow">{r.completedObjectives} objectives · {r.roundsSurvived} rounds · {r.stage}</span></div>
      <span className="rank-score">{(r.activeMs / 1000).toFixed(1)}s</span>
    </li>)}</ol>}
    {data?.scores.length === 0 && <p>No saved eligible runs in this mode yet.</p>}
  </dialog>
}
