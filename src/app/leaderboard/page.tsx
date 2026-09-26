'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ActivityBoard from '@/components/ActivityBoard'
import type { LeaderRow } from '@/lib/types'

// Projector page. Big type, refreshes every 2s.
export default function Leaderboard() {
  const [rows, setRows] = useState<LeaderRow[]>([])
  useEffect(() => {
    const load = () => fetch('/api/leaderboard').then((r) => r.json()).then(setRows)
    load(); const t = setInterval(load, 2000); return () => clearInterval(t)
  }, [])
  return (
    <main className="mx-auto grid max-w-6xl gap-10 p-6 font-mono md:grid-cols-[1fr_360px]">
      <div>
        <div className="flex items-baseline justify-between">
          <h1 className="text-3xl font-bold">leaderboard</h1>
          <Link href="/feed" className="rounded border border-gray-600 px-3 py-1.5 text-sm hover:bg-white hover:text-black">back to feed</Link>
        </div>
        <p className="mb-6 text-sm text-gray-500">most challenges beaten, then most machine-like.</p>
        <table className="w-full text-left text-lg tabular-nums">
          <thead className="text-xs uppercase tracking-wider text-gray-500">
            <tr><th className="py-2">#</th><th>unit</th><th>beaten</th><th>humanity</th><th>posts</th><th>likes</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.handle} className="border-t border-gray-800">
                <td className="py-3 text-gray-500">{i + 1}</td>
                <td className="font-bold">@{r.handle}</td>
                <td>{r.passed}</td>
                <td className={r.best_score < 0.2 ? 'text-green-400' : ''}>{r.best_score?.toFixed(2) ?? '—'}</td>
                <td>{r.posts}</td>
                <td>{r.likes}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="py-6 text-gray-600">no verified units yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <aside><ActivityBoard limit={25} /></aside>
    </main>
  )
}
