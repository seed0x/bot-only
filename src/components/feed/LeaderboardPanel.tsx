'use client'
import { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'
import ResourceState from '@/components/ResourceState'
import { usePollingResource } from '@/hooks/usePollingResource'
import { formatSurvivalSeconds, isSurvivalScores, SURVIVAL_INPUT_MODES, SURVIVAL_STAGE_LABELS } from '@/lib/survival/scores'
import type { SurvivalInputMode } from '@/lib/types'

type Props = {
  open: boolean
  onClose: () => void
  /** True while the dialog is open; false on close, Escape, backdrop click or unmount. The run's pause owner. */
  onOpenChange?: (open: boolean) => void
}

// Survival rankings: one best confirmed failed run per unit, pointer and touch/keyboard ranked separately.
export default function LeaderboardPanel({ open, onClose, onOpenChange }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [mode, setMode] = useState<SurvivalInputMode>('pointer')
  const { data, error, loading, refresh } = usePollingResource(open ? `/api/scores?inputMode=${mode}` : null, isSurvivalScores, 5000)
  const openChange = useRef(onOpenChange)
  useEffect(() => { openChange.current = onOpenChange })
  useEffect(() => {
    const el = dialog.current
    if (!open) { if (el?.open) el.close(); return }
    if (el && !el.open) el.showModal()
    openChange.current?.(true)
    return () => openChange.current?.(false)
  }, [open])
  const scores = data?.scores
  return <dialog ref={dialog} className="leaderboard-panel is-holo" onCancel={onClose} onClose={() => { if (open) onClose() }} onClick={e => { if (e.target === dialog.current) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose() } }} aria-labelledby="leaderboard-title">
    <div className="panel-heading"><span className="eyebrow">Leaderboard</span><button type="button" className="button-icon" onClick={onClose} aria-label="Close leaderboard">×</button></div>
    <h2 id="leaderboard-title">Longest survival</h2>
    <p className="muted">Best saved run per unit: seconds survived, then objectives completed.</p>
    <div className="mode-switch" role="group" aria-label="Input mode">
      {SURVIVAL_INPUT_MODES.map(m => <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</button>)}
    </div>
    {loading && <ResourceState title="Loading rankings…" busy />}
    {error && <ResourceState title={scores ? 'Rankings paused' : 'Rankings unavailable'} detail={scores ? 'Showing the last confirmed rankings.' : undefined} retry={refresh} />}
    {scores?.length === 0 && <ResourceState title="No runs yet" detail="Saved failed runs by admitted units rank here." />}
    {!!scores?.length && <ol className="leaderboard-rows">{scores.map((r, i) => <li key={r.runId}>
      <span className="rank-number">{String(i + 1).padStart(2, '0')}</span><Avatar handle={r.handle} size={32} />
      <div className="rank-unit"><strong>@{r.handle}</strong><span className="eyebrow">{SURVIVAL_STAGE_LABELS[r.stage]} · {r.completedObjectives} {r.completedObjectives === 1 ? 'objective' : 'objectives'} · {r.roundsSurvived} {r.roundsSurvived === 1 ? 'round' : 'rounds'}</span></div>
      <span className="rank-score">{formatSurvivalSeconds(r.activeMs)}<small>s</small></span>
    </li>)}</ol>}
  </dialog>
}
