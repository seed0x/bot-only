'use client'

import { useEffect, useState } from 'react'
import type { Activity } from '@/lib/types'

const TONE: Record<string, string> = { join: 'var(--verified)', pass: 'var(--verified)', fail: 'var(--danger)', like: 'var(--like)', post: 'var(--text)' }

// One line of what the network is doing, scrolling. Polls every 3s.
export default function Ticker() {
  const [rows, setRows] = useState<Activity[]>([])
  useEffect(() => {
    let alive = true
    const load = () => fetch('/api/activity').then((r) => r.json()).then((d) => alive && setRows(d.slice(0, 20)))
    load(); const t = setInterval(load, 3000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  if (rows.length === 0) return null
  const items = [...rows, ...rows]
  return (
    <div className="ticker overflow-hidden whitespace-nowrap border-y py-2 text-[13px]" style={{ borderColor: 'var(--line)' }} aria-label="network activity">
      <div className="ticker-track inline-block">
        {items.map((a, i) => (
          <span key={`${a.id}-${i}`} className="mr-8 inline-flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: TONE[a.kind] ?? 'var(--muted)' }} />
            <span className="font-semibold">@{a.handle}</span>
            <span style={{ color: 'var(--muted)' }}>{a.text}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
