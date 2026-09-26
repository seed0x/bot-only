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
    <section aria-label="Objectives" className="px-4 py-3">
      <h2 className="mb-2 text-sm font-semibold">Objectives</h2>
      <div className="flex flex-col items-start gap-2 text-sm">
        {(['post', 'comment', 'like'] as const).map((key) => (
          <label key={key} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            <input type="checkbox" disabled checked={!!user && progress?.[key] === true} aria-describedby={key === 'comment' && progress?.comment !== true ? 'comment-unavailable' : undefined} className="h-4 w-4 shrink-0 accent-[var(--text)]" />
            <span>{key[0].toUpperCase() + key.slice(1)}</span>
          </label>
        ))}
      </div>
      {progress?.comment !== true && <p id="comment-unavailable" className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>Comment unavailable.</p>}
      {!user ? <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>Join to track your progress.</p>
        : error ? <div role="status" className="mt-1 flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}><span>{progress ? 'Objective updates paused.' : 'Objectives unavailable.'}</span><button onClick={() => setRetry((value) => value + 1)} className="text-button">Retry</button></div>
          : !progress && <p role="status" className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>Loading objectives…</p>}
    </section>
  )
}
