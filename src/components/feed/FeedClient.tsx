'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import UnitChip from '@/components/feed/UnitChip'
import Composer from '@/components/feed/Composer'
import Objective from '@/components/feed/Objective'
import PostCard from '@/components/feed/PostCard'
import ResourceState from '@/components/ResourceState'
import type { SessionUser } from '@/lib/types'
import { usePollingResource } from '@/hooks/usePollingResource'
import { isPosts, isProgress } from '@/lib/validators'
import { jsonPost, requestJson } from '@/lib/api'

export default function FeedClient({ user, initialHumanity }: { user: SessionUser; initialHumanity: number }) {
  const router = useRouter()
  const posts = usePollingResource(`/api/posts?handle=${encodeURIComponent(user?.handle ?? '')}`, isPosts)
  const [objectiveRefresh, setObjectiveRefresh] = useState(0)
  const progress = usePollingResource(`/api/progress?handle=${encodeURIComponent(user?.handle ?? '')}`, isProgress)
  const [liked, setLiked] = useState<Set<number>>(new Set()), [pending, setPending] = useState<Set<number>>(new Set()), [likeError, setLikeError] = useState('')
  // The server admitted this user before rendering. Results loading is not authentication.
  const verified = user
  useEffect(() => {
    if (posts.errorStatus === 401) router.refresh()
  }, [posts.errorStatus, router])
  function refresh() { posts.refresh(); progress.refresh(); setObjectiveRefresh(n => n + 1) }
  async function like(id: number) {
    if (!verified || liked.has(id) || pending.has(id)) return
    setPending(s => new Set(s).add(id)); setLikeError('')
    try {
      await requestJson(`/api/posts/${id}/like`, jsonPost({ handle: verified.handle }), (v): v is { ok: true } => !!v && typeof v === 'object' && 'ok' in v && v.ok === true)
      setLiked(s => new Set(s).add(id)); refresh()
    } catch (e) { setLikeError(e instanceof Error ? e.message : 'Like not confirmed. Retry.'); posts.refresh() }
    finally { setPending(s => { const next = new Set(s); next.delete(id); return next }) }
  }
  const pinned = posts.data?.filter(p => p.pinned) ?? []
  const transmissions = posts.data?.filter(p => !p.pinned) ?? []
  const postCard = (p: NonNullable<typeof posts.data>[number]) => <PostCard key={p.id} post={p} liked={liked.has(p.id) || p.liked === 1} canLike={!!verified && !pending.has(p.id)} onLike={() => void like(p.id)} user={verified} replyRule={progress.data?.reply ?? null} onCommented={refresh} />
  return <div className="feed">
    <SiteHeader><div className="header-actions">
      <UnitChip user={user} humanity={progress.data?.humanity ?? initialHumanity} />
      <Link className="text-button" href="/leaderboard">Leaderboard</Link>
    </div></SiteHeader>
    <main className="feed-layout feed-grid">
      <h1 className="sr-only">Feed</h1>
      <aside className="feed-aside" aria-label="Post creation and objectives">
        <Composer user={verified} rule={progress.data?.transmission ?? null} onPosted={refresh} />
        <div className="feed-objectives"><Objective key={user?.handle ?? 'visitor'} user={user} refreshKey={objectiveRefresh} /></div>
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
