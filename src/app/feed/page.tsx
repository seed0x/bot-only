'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import UnitChip from '@/components/feed/UnitChip'
import Composer from '@/components/feed/Composer'
import Objective from '@/components/feed/Objective'
import PostCard from '@/components/feed/PostCard'
import { getSessionUser } from '@/lib/session'
import type { Post, SessionUser } from '@/lib/types'

// The network. One column of transmissions; verification happens before posting.
export default function Feed() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [humanity, setHumanity] = useState<number | null>(null)
  const [verified, setVerified] = useState(false)
  const [liked, setLiked] = useState<Set<number>>(new Set())
  const [liking, setLiking] = useState<Set<number>>(new Set())
  const [likeErrors, setLikeErrors] = useState<Record<number, string>>({})
  const [objectiveRefresh, setObjectiveRefresh] = useState(0)
  const postsRequest = useRef(0)

  useEffect(() => { setUser(getSessionUser()) }, [])

  const load = useCallback(() => {
    const request = ++postsRequest.current
    const handle = getSessionUser()?.handle ?? ''
    fetch(`/api/posts?handle=${encodeURIComponent(handle)}`).then((r) => r.json()).then((rows: Post[]) => {
      if (request !== postsRequest.current) return
      setPosts(rows)
      setLiked(new Set(rows.filter((post) => post.liked === 1).map((post) => post.id)))
    })
    fetch(`/api/progress?handle=${encodeURIComponent(handle)}`)
      .then((r) => r.json())
      .then((d) => { setHumanity(d.humanity); setVerified(!!d.verified) })
  }, [])
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t) }, [load])

  async function like(id: number) {
    if (!user || liked.has(id) || liking.has(id)) return
    setLiking((s) => new Set(s).add(id))
    setLikeErrors((errors) => { const next = { ...errors }; delete next[id]; return next })
    try {
      const response = await fetch(`/api/posts/${id}/like`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ handle: user.handle }) })
      const result = await response.json().catch(() => null) as { likes?: number; error?: string } | null
      if (!response.ok || !result || !Number.isInteger(result.likes)) throw new Error(result?.error || 'Like was not confirmed. Retry.')
      // Invalidate polls started before the acknowledgement so an old count cannot win the race.
      postsRequest.current++
      setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, likes: result.likes! } : p)))
      setLiked((s) => new Set(s).add(id))
      setObjectiveRefresh((value) => value + 1)
      load()
    } catch (error) {
      setLikeErrors((errors) => ({ ...errors, [id]: error instanceof Error ? error.message : 'Like was not confirmed. Retry.' }))
    } finally {
      setLiking((s) => { const next = new Set(s); next.delete(id); return next })
    }
  }

  return (
    <div className="feed min-h-screen">
      <header className="sticky top-0 z-30 border-b backdrop-blur" style={{ background: 'color-mix(in srgb, var(--bg) 85%, transparent)', borderColor: 'var(--line)' }}>
        <div className="mx-auto flex max-w-[1000px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <UnitChip user={user} humanity={humanity} />
        </div>
      </header>

      <main className="mx-auto grid max-w-[620px] items-start gap-6 px-4 pb-24 pt-4 lg:max-w-[1000px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <aside aria-label="Post creation and objectives" className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1">
          {user && verified ? (
            <Composer user={user} onPosted={() => { setObjectiveRefresh((value) => value + 1); load() }} />
          ) : (
            <div className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
              {user ? 'Unverified. Complete verification to transmit.' : <>Read-only. <a href="/" className="underline">Enter a designation</a>.</>}
            </div>
          )}
          <div className="overflow-hidden rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
            <Objective key={user?.handle ?? 'visitor'} user={user} refreshKey={objectiveRefresh} />
          </div>
        </aside>
        <section aria-label="Posts" className="min-w-0 lg:col-start-1 lg:row-start-1">
          {posts.map((post) =>
            <div key={`p-${post.id}`} className="border-b" style={{ borderColor: 'var(--line)' }}><PostCard post={post} liked={liked.has(post.id)} canLike={!!user && verified && !liking.has(post.id)} onLike={() => like(post.id)} />{likeErrors[post.id] && <p role="status" className="pb-3 pl-14 text-sm" style={{ color: 'var(--danger)' }}>{likeErrors[post.id]}</p>}</div>,
          )}
          {posts.length === 0 && <p className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>Nothing on the network yet.</p>}
        </section>
      </main>

    </div>
  )
}
