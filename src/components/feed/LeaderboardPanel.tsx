'use client'
import { useEffect, useRef } from 'react'
import { useSurvivalGame } from '@/components/game/GameProvider'
import Avatar from './Avatar'
import { usePollingResource } from '@/hooks/usePollingResource'
import { isLeaders } from '@/lib/validators'

export default function LeaderboardPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pause } = useSurvivalGame()
  useEffect(() => {
    if (!open) return
    pause('leaderboard', true)
    return () => pause('leaderboard', false)
  }, [open, pause])
  const dialog = useRef<HTMLDialogElement>(null)
  const { data, error, loading, refresh } = usePollingResource(open ? '/api/leaderboard' : null, isLeaders, 2000)
  useEffect(() => {
    const el = dialog.current
    if (open) el?.showModal()
    else el?.close()
  }, [open])
  return <dialog ref={dialog} className="leaderboard-panel is-holo" onCancel={onClose} onClick={e => { if (e.target === dialog.current) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose() } }} aria-labelledby="leaderboard-title">
    <div className="panel-heading"><span className="eyebrow">Leaderboard</span><button className="button-icon" onClick={onClose} aria-label="Close leaderboard">×</button></div>
    <h2 id="leaderboard-title">Least human</h2><p className="muted">Tests beaten, then lowest humanity.</p>
    {loading && <p role="status">Loading…</p>}
    {error && <p role="alert">Rankings unavailable. <button className="text-button" onClick={refresh}>Retry</button></p>}
    {data && <ol className="leaderboard-rows">{data.map((r, i) => <li key={r.handle}>
      <span className="rank-number">{String(i + 1).padStart(2, '0')}</span><Avatar handle={r.handle} size={32} />
      <div className="rank-unit"><strong>@{r.handle}</strong><span className="eyebrow">{r.passed} tests / {r.posts} posts</span></div>
      <span className="rank-score">{r.best_score?.toFixed(2) ?? '—'}</span>
    </li>)}</ol>}
    {data?.length === 0 && <p>No one has passed yet.</p>}
  </dialog>
}
