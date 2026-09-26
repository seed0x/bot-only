'use client'

import { useEffect, useState } from 'react'
import type { Activity } from '@/lib/types'

const COLOR: Record<string, string> = { join: 'text-green-400', pass: 'text-green-400', fail: 'text-red-400', post: 'text-white', like: 'text-pink-400' }

// Live tail of everything happening on the network. Polls every 2s.
export default function ActivityBoard({ limit = 20 }: { limit?: number }) {
  const [rows, setRows] = useState<Activity[]>([])
  useEffect(() => {
    let alive = true
    const load = () => fetch('/api/activity').then((r) => r.json()).then((d) => alive && setRows(d))
    load()
    const t = setInterval(load, 2000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  return (
    <div className="font-mono text-xs">
      <div className="mb-2 uppercase tracking-wider text-gray-500">activity</div>
      <ul className="space-y-1">
        {rows.slice(0, limit).map((a) => (
          <li key={a.id} className="flex gap-2">
            <span className="shrink-0 text-gray-600">{a.created_at.slice(11, 19)}</span>
            <span className={`shrink-0 ${COLOR[a.kind] ?? 'text-gray-300'}`}>{a.kind}</span>
            <span className="text-gray-400">@{a.handle}</span>
            <span className="truncate text-gray-300">{a.text}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="text-gray-600">nothing yet.</li>}
      </ul>
    </div>
  )
}
