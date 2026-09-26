'use client'

import { useEffect, useState } from 'react'
import type { ObjectiveProgress, SessionUser } from '@/lib/types'

export default function Objective({ user, refreshKey }: { user: SessionUser | null; refreshKey: number }) {
  const [progress, setProgress] = useState<ObjectiveProgress | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!user) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController
    async function load() {
      controller = new AbortController()
      const deadline = setTimeout(() => controller.abort(), 10000)
      try {
        const response = await fetch(`/api/objectives?handle=${encodeURIComponent(user!.handle)}`, { signal: controller.signal })
        const data: unknown = await response.json()
        if (!response.ok || !data || typeof data !== 'object' || !('post' in data) || typeof data.post !== 'boolean' || !('like' in data) || typeof data.like !== 'boolean' || !('comment' in data) || (data.comment !== null && typeof data.comment !== 'boolean')) throw new Error('Invalid objective response')
        if (active) {
          setProgress(data as ObjectiveProgress)
          setError(false)
          timer = setTimeout(load, 4000)
        }
      } catch {
        if (active) setError(true)
      } finally {
        clearTimeout(deadline)
      }
    }
    void load()
    return () => { active = false; clearTimeout(timer); controller?.abort() }
  }, [user, refreshKey, retry])

  return (
    <section aria-label="Objectives" className="border-t px-4 py-2" style={{ borderColor: 'var(--line)' }}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="font-semibold">Objectives</span>
        {(['post', 'comment', 'like'] as const).map((key) => (
          <label key={key} className="flex items-center gap-1.5">
            <input type="checkbox" disabled checked={!!user && progress?.[key] === true} className="h-4 w-4 accent-[var(--text)]" />
            <span>{key[0].toUpperCase() + key.slice(1)}{key === 'comment' && progress?.comment !== true && <span className="text-xs" style={{ color: 'var(--muted)' }}> (unavailable)</span>}</span>
          </label>
        ))}
      </div>
      {!user ? <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>Enter a designation to track your objectives.</p>
        : error ? <div role="status" className="mt-1 flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}><span>{progress ? 'Objective updates paused.' : 'Objectives unavailable.'}</span><button onClick={() => setRetry((value) => value + 1)} className="min-h-11 px-2 underline">Retry</button></div>
          : !progress && <p role="status" className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>Loading objectives…</p>}
    </section>
  )
}
