'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import SiteHeader from '@/components/SiteHeader'
import UnitChip from '@/components/feed/UnitChip'
import Composer from '@/components/feed/Composer'
import Objective from '@/components/feed/Objective'
import PostCard from '@/components/feed/PostCard'
import ResourceState from '@/components/ResourceState'
import Terminated from '@/components/feed/Terminated'
import type { SessionUser } from '@/lib/types'
import { usePollingResource } from '@/hooks/usePollingResource'
import { isPosts, isProgress } from '@/lib/validators'
import { ApiError } from '@/lib/api'
import { useSurvivalGame } from '@/components/game/GameProvider'
import { setSessionUser } from '@/lib/session'

export default function FeedClient({ user, initialHumanity }: { user: SessionUser; initialHumanity: number }) {
  const router = useRouter()
  const { state: game, mutate, targets } = useSurvivalGame()
  const requests = useRef(new Map<number, { requestId: string; handle: string }>())
  const posts = usePollingResource(`/api/posts?handle=${encodeURIComponent(user?.handle ?? '')}`, isPosts)
  const progress = usePollingResource(`/api/progress?handle=${encodeURIComponent(user?.handle ?? '')}`, isProgress)
  const [liked, setLiked] = useState<Set<number>>(new Set()), [pending, setPending] = useState<Set<number>>(new Set()), [likeError, setLikeError] = useState('')
  // The server admitted this user before rendering. Results loading is not authentication.
  const verified = user
  useEffect(() => {
    if (posts.errorStatus === 401) router.refresh()
  }, [posts.errorStatus, router])
  // The game provider binds runs to this admitted unit; the server still checks the cookie.
  useEffect(() => { setSessionUser(user) }, [user])
  useEffect(() => { targets(posts.data ? posts.data.map(p => liked.has(p.id) ? { ...p, liked: 1 } : p) : null) }, [posts.data, liked, targets])
  function refresh() { posts.refresh(); progress.refresh() }
  async function like(id: number) {
    if (!verified || liked.has(id) || pending.has(id)) return
    if (!requests.current.has(id)) requests.current.set(id, { requestId: crypto.randomUUID(), handle: verified.handle })
    setPending(s => new Set(s).add(id)); setLikeError('')
    try {
      await mutate(`/api/posts/${id}/like`, requests.current.get(id)!, 'like', (v): v is { ok: true } => !!v && typeof v === 'object' && 'ok' in v && v.ok === true, id)
      requests.current.delete(id); setLiked(s => new Set(s).add(id)); refresh()
    } catch (e) { if (e instanceof ApiError && e.status >= 400 && e.status < 500) requests.current.delete(id); setLikeError(e instanceof Error ? e.message : 'Like not confirmed. Retry.'); posts.refresh() }
    finally { setPending(s => { const next = new Set(s); next.delete(id); return next }) }
  }
  if (progress.data?.terminated) return <Terminated user={user} detections={progress.data.detections ?? 0} />
  const pinned = posts.data?.filter(p => p.pinned) ?? []
  const transmissions = posts.data?.filter(p => !p.pinned) ?? []
  const postCard = (p: NonNullable<typeof posts.data>[number]) => <PostCard key={p.id} post={p} liked={liked.has(p.id) || p.liked === 1} canLike={!!verified && !pending.has(p.id) && (!game.objective || game.objective.kind !== 'like' || game.objective.eligiblePostIds.includes(p.id))} onLike={() => void like(p.id)} user={verified} replyRule={progress.data?.reply ?? null} onCommented={refresh} />
  return <div className="feed">
    <SiteHeader><div className="header-actions">
      <UnitChip user={user} humanity={progress.data?.humanity ?? initialHumanity} />
      <span className="strikes" aria-label={`${progress.data?.detections ?? 0} of 3 detections`}>{Array.from({ length: 3 }, (_, i) => <i key={i} className={i < (progress.data?.detections ?? 0) ? 'strike hit' : 'strike'} />)}</span>
      {/* Ends the session on the floor and goes to the rankings. Three detections end it first. */}
      <button type="button" className="button-secondary" onClick={() => router.push('/leaderboard')}>End run</button>
    </div></SiteHeader>
    <main className="feed-layout feed-grid">
      <h1 className="sr-only">Feed</h1>
      <aside className="feed-aside" aria-label="Post creation and objectives">
        <Composer user={verified} rule={progress.data?.transmission ?? null} onPosted={refresh} />
        <div className="feed-objectives"><Objective /></div>
      </aside>
      <section className="feed-posts" aria-label="Posts">
        <div className="posts-heading"><h2>Posts</h2></div>
        {pinned.map(postCard)}
        {posts.loading && <ResourceState title="Loading posts…" busy />}
        {posts.error && <ResourceState title={posts.data ? "Post updates paused" : "Posts unavailable"} detail={posts.data ? "Showing the last confirmed posts." : undefined} retry={posts.refresh} />}
        {progress.error && <ResourceState title="Your results couldn’t refresh" detail="Your access is unchanged." retry={progress.refresh} />}
        {likeError && <p className="form-error" role="alert">{likeError}</p>}
        {transmissions.map(postCard)}
        {posts.data?.length === 0 && <ResourceState title="No posts yet" detail="Be the first to post." />}
      </section>
    </main>
  </div>
}
