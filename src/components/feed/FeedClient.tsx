'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SessionEnded from '@/components/game/SessionEnded'
import { useSurvivalGame } from '@/components/game/GameProvider'
import SiteHeader from '@/components/SiteHeader'
import UnitChip from '@/components/feed/UnitChip'
import Composer from '@/components/feed/Composer'
import Objective from '@/components/feed/Objective'
import PostCard from '@/components/feed/PostCard'
import ResourceState from '@/components/ResourceState'
import type { SessionUser } from '@/lib/types'
import { usePollingResource } from '@/hooks/usePollingResource'
import { isPosts, isProgress } from '@/lib/validators'
import { ApiError, jsonPost, requestJson } from '@/lib/api'

export default function FeedClient({ user, initialHumanity }: { user: SessionUser; initialHumanity: number }) {
  const router = useRouter()
  const { state: game, mutate, targets, end: endRun } = useSurvivalGame()
  const likeRequests = useRef(new Map<number, { requestId: string; handle: string }>())
  const likeLocks = useRef(new Set<number>())
  const [ended, setEnded] = useState(false), [ending, setEnding] = useState(false), [endError, setEndError] = useState('')
  const endLock = useRef(false)
  async function endGame() {
    if (endLock.current) return
    endLock.current = true; setEnding(true); setEndError('')
    try {
      if (game.run) { await endRun(); return }
      await requestJson('/api/session/end', jsonPost({}), (v): v is { ok: true } => !!v && typeof v === 'object' && 'ok' in v && v.ok === true)
      setEnded(true)
    } catch (error) { setEndError(error instanceof Error ? error.message : 'Couldn’t confirm the end of this session. Retry.') }
    finally { endLock.current = false; setEnding(false) }
  }
  const posts = usePollingResource(ended || ending || endError ? null : `/api/posts?handle=${encodeURIComponent(user?.handle ?? '')}`, isPosts)
  const progress = usePollingResource(ended || ending || endError ? null : `/api/progress?handle=${encodeURIComponent(user?.handle ?? '')}`, isProgress)
  const [liked, setLiked] = useState<Set<number>>(new Set()), [pending, setPending] = useState<Set<number>>(new Set()), [likeError, setLikeError] = useState('')
  // The server admitted this user before rendering. Results loading is not authentication.
  const verified = user
  useEffect(() => {
    if (!ended && !ending && !endError && posts.errorStatus === 401) router.refresh()
  }, [posts.errorStatus, router, ended, ending, endError])
  function refresh() { posts.refresh(); progress.refresh() }
  useEffect(() => { targets(posts.data ? posts.data.map(p => liked.has(p.id) ? { ...p, liked: 1 } : p) : null) }, [posts.data, liked, targets])
  async function like(id: number) {
    if (!verified || liked.has(id) || likeLocks.current.has(id)) return
    likeLocks.current.add(id)
    if (!likeRequests.current.has(id)) likeRequests.current.set(id, { requestId: crypto.randomUUID(), handle: verified.handle })
    setPending(s => new Set(s).add(id)); setLikeError('')
    try {
      await mutate(`/api/posts/${id}/like`, likeRequests.current.get(id)!, 'like', (v): v is { ok: true } => !!v && typeof v === 'object' && 'ok' in v && v.ok === true, id)
      likeRequests.current.delete(id); setLiked(s => new Set(s).add(id)); refresh()
    } catch (e) { if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) likeRequests.current.delete(id); setLikeError(e instanceof Error ? e.message : 'Like not confirmed. Retry.'); posts.refresh() }
    finally { likeLocks.current.delete(id); setPending(s => { const next = new Set(s); next.delete(id); return next }) }
  }
  const pinned = posts.data?.filter(p => p.pinned) ?? []
  const transmissions = posts.data?.filter(p => !p.pinned) ?? []
  const postCard = (p: NonNullable<typeof posts.data>[number]) => <PostCard key={p.id} post={p} liked={liked.has(p.id) || p.liked === 1} canLike={!!verified && !pending.has(p.id) && (game.objective?.kind !== 'like' || game.objective.eligiblePostIds.includes(p.id))} onLike={() => void like(p.id)} user={verified} replyRule={progress.data?.reply ?? null} onCommented={refresh} />
  if (ended) return <SessionEnded handle={user.handle} />
  return <div className="feed">
    <SiteHeader><div className="header-actions">
      <UnitChip user={user} humanity={progress.data?.humanity ?? initialHumanity} />
      <Link className="button-secondary" href="/?retry=1">Retry CAPTCHA</Link>
      {!game.run && <button type="button" className="button-secondary" disabled={ending} onClick={() => void endGame()}>{ending ? 'Ending…' : endError ? 'Retry ending' : 'End game'}</button>}
    </div></SiteHeader>
    {endError && <p className="session-error form-error" role="alert">{endError} Retry ending before continuing.</p>}
    {ending || endError ? <ResourceState title={ending ? "Ending session…" : "Session end not confirmed"} busy={ending} /> : <main className="feed-layout feed-grid">
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
    </main>}
  </div>
}
