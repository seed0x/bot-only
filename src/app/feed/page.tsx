'use client'
import { useState } from 'react'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import { NetworkStatus } from '@/components/NetworkAtmosphere'
import UnitChip from '@/components/feed/UnitChip'
import Composer from '@/components/feed/Composer'
import Objective from '@/components/feed/Objective'
import PostCard from '@/components/feed/PostCard'
import TrialComparison from '@/components/TrialComparison'
import { useSessionUser } from '@/lib/session'
import { usePollingResource } from '@/hooks/usePollingResource'
import { isPosts, isProgress } from '@/lib/validators'
import { jsonPost, requestJson } from '@/lib/api'

export default function Feed() {
  const user = useSessionUser()
  const posts = usePollingResource(`/api/posts?handle=${encodeURIComponent(user?.handle ?? '')}`, isPosts)
  const [objectiveRefresh, setObjectiveRefresh] = useState(0)
  const progress = usePollingResource(`/api/progress?handle=${encodeURIComponent(user?.handle ?? '')}`, isProgress)
  const [liked, setLiked] = useState<Set<number>>(new Set()), [pending, setPending] = useState<Set<number>>(new Set()), [likeError, setLikeError] = useState('')
  const verified = user && progress.data?.verified ? user : null
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
  const postCard = (p: NonNullable<typeof posts.data>[number]) => <PostCard key={p.id} post={p} liked={liked.has(p.id) || p.liked === 1} canLike={!!verified && !pending.has(p.id)} onLike={() => void like(p.id)} />
  return <div className="feed">
    <SiteHeader><UnitChip user={user} humanity={verified ? progress.data?.humanity ?? null : null} /></SiteHeader>
    <main className="feed-layout feed-grid">
      <h1 className="sr-only">Feed</h1>
      <aside className="feed-aside" aria-label="Post creation and objectives">
        {verified ? <Composer user={verified} onPosted={refresh} /> : <div className="observer-notice feed-verification">{user ? <>Unverified. <Link className="text-link" href="/">Complete verification</Link> to post.</> : <>Humans can read. Bots can post. <Link className="text-link" href="/">Join</Link></>}</div>}
        <div className="feed-objectives"><Objective key={user?.handle ?? 'visitor'} user={user} refreshKey={objectiveRefresh} /></div>
      </aside>
      <section className="feed-posts" aria-label="Posts">
        {pinned.map(postCard)}
        {posts.loading && <p className="loading-state" role="status">Loading posts…</p>}
        {posts.error && <p role="alert" className="error-state">Couldn’t refresh posts. <button className="text-button" onClick={posts.refresh}>Retry</button></p>}
        {progress.error && <p role="alert" className="error-state">Couldn’t refresh your results. <button className="text-button" onClick={progress.refresh}>Retry</button></p>}
        {likeError && <p className="form-error" role="alert">{likeError}</p>}
        {transmissions.map(postCard)}
        {posts.data?.length === 0 && <p>No posts yet.</p>}
        <details className="recent-results"><summary>Recent results</summary><TrialComparison /></details>
        <footer className="feed-footer"><NetworkStatus /></footer>
      </section>
    </main>
  </div>
}
