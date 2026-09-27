'use client'
import { useEffect, useRef, useState } from 'react'
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
import { ApiError } from '@/lib/api'
import { useSurvivalGame } from '@/components/game/GameProvider'

export default function Feed() {
  const { state: game, mutate, targets, resource } = useSurvivalGame()
  const requests = useRef(new Map<number, { requestId: string; handle: string }>())
  const locks = useRef(new Set<number>())
  const user = useSessionUser()
  const posts = usePollingResource(`/api/posts?handle=${encodeURIComponent(user?.handle ?? '')}`, isPosts)
  const progress = usePollingResource(`/api/progress?handle=${encodeURIComponent(user?.handle ?? '')}`, isProgress)
  const [liked, setLiked] = useState<Set<number>>(new Set()), [pending, setPending] = useState<Set<number>>(new Set()), [likeError, setLikeError] = useState('')
  const verified = user && progress.data?.verified ? user : null
  const admissionReady = !!verified
  function refresh() { posts.refresh(); progress.refresh() }
  useEffect(() => { targets(posts.data ? posts.data.map(p => liked.has(p.id) ? { ...p, liked: 1 } : p) : null) }, [posts.data, liked, targets])
  useEffect(() => {
    resource('feed_identity', !!game.user && !admissionReady)
    return () => resource('feed_identity', false)
  }, [game.user, admissionReady, resource])
  async function like(id: number) {
    if (game.phase === 'ended' || !verified || liked.has(id) || locks.current.has(id)) return
    locks.current.add(id)
    if (!requests.current.has(id)) requests.current.set(id, { requestId: crypto.randomUUID(), handle: verified.handle })
    setPending(s => new Set(s).add(id)); setLikeError('')
    try {
      await mutate(`/api/posts/${id}/like`, requests.current.get(id)!, 'like', (v): v is { ok: true } => !!v && typeof v === 'object' && 'ok' in v && v.ok === true, id)
      requests.current.delete(id); setLiked(s => new Set(s).add(id)); refresh()
    } catch (e) { if (e instanceof ApiError && e.status >= 400 && e.status < 500) requests.current.delete(id); setLikeError(e instanceof Error ? e.message : 'Like not confirmed. Retry.'); posts.refresh() }
    finally { locks.current.delete(id); setPending(s => { const next = new Set(s); next.delete(id); return next }) }
  }
  const pinned = posts.data?.filter(p => p.pinned) ?? []
  const transmissions = posts.data?.filter(p => !p.pinned) ?? []
  const postCard = (p: NonNullable<typeof posts.data>[number]) => <PostCard key={p.id} post={p} liked={liked.has(p.id) || p.liked === 1} canLike={game.phase !== 'ended' && !!verified && !pending.has(p.id) && (!game.objective || game.objective.kind !== 'like' || game.objective.eligiblePostIds.includes(p.id))} onLike={() => void like(p.id)} />
  return <div className="feed">
    <SiteHeader><UnitChip user={user} humanity={verified ? progress.data?.humanity ?? null : null} /></SiteHeader>
    <main className="feed-layout feed-grid">
      <h1 className="sr-only">Feed</h1>
      <aside className="feed-aside" aria-label="Post creation and objectives">
        {verified ? <Composer user={verified} onPosted={refresh} /> : <div className="observer-notice">{user && (progress.loading || progress.error) ? <p role="status">{progress.error ? 'Admission status unavailable. Retry your results below.' : 'Checking admission…'}</p> : user ? <>Unverified. <Link className="text-link" href="/">Complete verification</Link> to post.</> : <>Humans can read. Bots can post. <Link className="text-link" href="/">Join</Link></>}</div>}
        <div className="feed-objectives is-holo"><Objective /></div>
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
