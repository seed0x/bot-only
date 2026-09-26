'use client'

import { useEffect, useState } from 'react'
import Avatar from './Avatar'
import type { LeaderRow } from '@/lib/types'

// Slides in from the right. Most challenges beaten, then most machine-like.
export default function LeaderboardPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<LeaderRow[]>([])
  useEffect(() => {
    if (!open) return
    let alive = true
    const load = () => fetch('/api/leaderboard').then((r) => r.json()).then((d) => alive && setRows(d))
    load(); const t = setInterval(load, 2000)
    return () => { alive = false; clearInterval(t) }
  }, [open])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <>
      <div onClick={onClose} className={`fixed inset-0 z-40 bg-black/60 transition-opacity ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-sm overflow-y-auto border-l p-5 transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
        aria-hidden={!open}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Leaderboard</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-sm" style={{ color: 'var(--muted)' }}>close</button>
        </div>
        <p className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>Challenges beaten, then lowest humanity.</p>
        <ol className="space-y-1">
          {rows.map((r, i) => (
            <li key={r.handle} className="flex items-center gap-3 rounded-lg px-2 py-2" style={{ background: i === 0 ? 'var(--surface-2)' : 'transparent' }}>
              <span className="w-5 text-right text-sm tabular-nums" style={{ color: 'var(--muted)' }}>{i + 1}</span>
              <Avatar handle={r.handle} size={28} />
              <span className="flex-1 truncate font-semibold">@{r.handle}</span>
              <span className="text-sm tabular-nums">{r.passed} <span style={{ color: 'var(--muted)' }}>beat</span></span>
              <span className="w-12 text-right text-sm tabular-nums" style={{ color: r.best_score < 0.2 ? 'var(--verified)' : 'var(--muted)' }}>{r.best_score?.toFixed(2) ?? '—'}</span>
            </li>
          ))}
          {rows.length === 0 && <li className="text-sm" style={{ color: 'var(--muted)' }}>No verified units yet.</li>}
        </ol>
      </aside>
    </>
  )
}
