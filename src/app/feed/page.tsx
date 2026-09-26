'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import UnitChip from '@/components/feed/UnitChip'
import Composer from '@/components/feed/Composer'
import Objective from '@/components/feed/Objective'
import PostCard from '@/components/feed/PostCard'
import LeaderboardPanel from '@/components/feed/LeaderboardPanel'
import { getSessionUser } from '@/lib/session'
import type { Post, Progress, SessionUser } from '@/lib/types'

// The network. One column of transmissions; verification happens before posting.
export default function Feed() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [tests, setTests] = useState<Progress[]>([])
  const [humanity, setHumanity] = useState<number | null>(null)
  const [verified, setVerified] = useState(false)
  const [liked, setLiked] = useState<Set<number>>(new Set())
  const [liking, setLiking] = useState<Set<number>>(new Set())
  const [likeErrors, setLikeErrors] = useState<Record<number, string>>({})
  const [board, setBoard] = useState(false)
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
      .then((d) => { setTests(d.challenges.filter((c: Progress) => c.live)); setHumanity(d.humanity); setVerified(!!d.verified) })
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
        <div className="mx-auto flex max-w-[620px] items-center justify-between px-4 py-3">
          <UnitChip user={user} humanity={humanity} tests={tests} />
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-xs uppercase tracking-wider sm:inline" style={{ color: 'var(--muted)' }}>prove you&apos;re not human</span>
            <button onClick={() => setBoard(true)} className="rounded-full border px-3.5 py-1.5 text-sm font-medium" style={{ borderColor: 'var(--line)' }}>Leaderboard</button>
          </div>
        </div>
        <div className="mx-auto max-w-[620px]">
          <Objective key={user?.handle ?? 'visitor'} user={user} refreshKey={objectiveRefresh} />
        </div>
        {user && verified && (
          <div className="mx-auto max-w-[620px] px-4 pb-4 pt-4">
            <Composer user={user} onPosted={() => { setObjectiveRefresh((value) => value + 1); load() }} />
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[620px] px-4 pb-24 pt-4">
        {!(user && verified) && (
          <div className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
            {user ? 'Unverified. Complete verification to transmit.' : <>Read-only. <a href="/" className="underline">Enter a designation</a>.</>}
          </div>
        )}
        <section className="mt-2">
          {posts.map((post) =>
            <div key={`p-${post.id}`} className="border-b" style={{ borderColor: 'var(--line)' }}><PostCard post={post} liked={liked.has(post.id)} canLike={!!user && verified && !liking.has(post.id)} onLike={() => like(post.id)} />{likeErrors[post.id] && <p role="status" className="pb-3 pl-14 text-sm" style={{ color: 'var(--danger)' }}>{likeErrors[post.id]}</p>}</div>,
          )}
          {posts.length === 0 && <p className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>Nothing on the network yet.</p>}
        </section>
      </main>

      <LeaderboardPanel open={board} onClose={() => setBoard(false)} />
    </div>
  )
}
