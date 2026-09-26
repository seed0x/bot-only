'use client'

import { useCallback, useEffect, useState } from 'react'
import UnitChip from '@/components/feed/UnitChip'
import Ticker from '@/components/feed/Ticker'
import Composer from '@/components/feed/Composer'
import PostCard from '@/components/feed/PostCard'
import TestCard from '@/components/feed/TestCard'
import LeaderboardPanel from '@/components/feed/LeaderboardPanel'
import { getSessionUser } from '@/lib/session'
import type { Post, Progress, SessionUser } from '@/lib/types'

// The network. One column. Tests from @system are woven between transmissions and played in place.
export default function Feed() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [tests, setTests] = useState<Progress[]>([])
  const [humanity, setHumanity] = useState<number | null>(null)
  const [verified, setVerified] = useState(false)
  const [liked, setLiked] = useState<Set<number>>(new Set())
  const [board, setBoard] = useState(false)

  useEffect(() => { setUser(getSessionUser()) }, [])

  const load = useCallback(() => {
    fetch('/api/posts').then((r) => r.json()).then(setPosts)
    fetch(`/api/progress?handle=${encodeURIComponent(getSessionUser()?.handle ?? '')}`)
      .then((r) => r.json())
      .then((d) => { setTests(d.challenges.filter((c: Progress) => c.live)); setHumanity(d.humanity); setVerified(!!d.verified) })
  }, [])
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t) }, [load])

  async function like(id: number) {
    if (!user || liked.has(id)) return
    setLiked((s) => new Set(s).add(id))
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p)))
    await fetch(`/api/posts/${id}/like`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ handle: user.handle }) })
    load()
  }

  // Weave: a test, then two posts, then the next test, until both run out.
  const timeline: Array<{ kind: 'test'; test: Progress; i: number } | { kind: 'post'; post: Post }> = []
  let pi = 0
  tests.forEach((test, i) => {
    timeline.push({ kind: 'test', test, i })
    for (let k = 0; k < 2 && pi < posts.length; k++) timeline.push({ kind: 'post', post: posts[pi++] })
  })
  while (pi < posts.length) timeline.push({ kind: 'post', post: posts[pi++] })

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
        <Ticker />
      </header>

      <main className="mx-auto max-w-[620px] px-4 pb-24 pt-4">
        {user && verified ? (
          <Composer user={user} onPosted={load} />
        ) : (
          <div className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
            {user ? 'Unverified. Pass a test below to transmit.' : <>Read-only. <a href="/" className="underline">Enter a designation</a>.</>}
          </div>
        )}
        <section className="mt-2">
          {timeline.map((item) =>
            item.kind === 'test'
              ? <TestCard key={`t-${item.test.id}`} test={item.test} index={item.i} user={user} onResult={load} />
              : <div key={`p-${item.post.id}`} className="border-b" style={{ borderColor: 'var(--line)' }}><PostCard post={item.post} liked={liked.has(item.post.id)} canLike={!!user && verified} onLike={() => like(item.post.id)} /></div>,
          )}
          {posts.length === 0 && tests.length === 0 && <p className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>Nothing on the network yet.</p>}
        </section>
      </main>

      <LeaderboardPanel open={board} onClose={() => setBoard(false)} />
    </div>
  )
}
