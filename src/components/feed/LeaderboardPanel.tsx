'use client'
import { useEffect, useRef } from 'react'
import LeaderboardContent from './LeaderboardContent'

type Props = {
  open: boolean
  onClose: () => void
  /** True while the dialog is open; false on close, Escape, backdrop click or unmount. The run's pause owner. */
  onOpenChange?: (open: boolean) => void
}

// The dialog owns focus and pause notifications; ranking data/rendering is shared with registration.
export default function LeaderboardPanel({ open, onClose, onOpenChange }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const openChange = useRef(onOpenChange)
  useEffect(() => { openChange.current = onOpenChange })
  useEffect(() => {
    const el = dialog.current
    if (!open) { if (el?.open) el.close(); return }
    if (el && !el.open) el.showModal()
    openChange.current?.(true)
    return () => openChange.current?.(false)
  }, [open])
  return <dialog ref={dialog} className="leaderboard-panel is-holo" onCancel={onClose} onClose={() => { if (open) onClose() }} onClick={e => { if (e.target === dialog.current) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose() } }} aria-labelledby="leaderboard-title">
    <div className="panel-heading"><span className="eyebrow">Leaderboard</span><button type="button" className="button-icon" onClick={onClose} aria-label="Close leaderboard">×</button></div>
    <h2 id="leaderboard-title">Fastest verification</h2>
    <p className="muted">Best successful time per person. Fastest first.</p>
    <LeaderboardContent active={open} />
  </dialog>
}
