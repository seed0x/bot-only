import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import LeaderboardContent from '@/components/feed/LeaderboardContent'
import { getDb } from '@/lib/db'
import { DETECTIONS_TODAY_SQL, RECENT_DETECTIONS_SQL, detectionReason, type Detection } from '@/lib/leaderboard'

export const dynamic = 'force-dynamic'

// The leaderboard is its own screen, reached after a game, never a panel over the feed.
export default function LeaderboardPage() {
  const db = getDb()
  const caught = (db.prepare(DETECTIONS_TODAY_SQL).get() as { n: number }).n
  const recent = db.prepare(RECENT_DETECTIONS_SQL).all() as Detection[]
  return <>
    <SiteHeader><Link className="text-link" href="/feed">Feed</Link></SiteHeader>
    <main className="leaderboard-page">
      <p className="eyebrow">Leaderboard</p>
      <h1>Fastest verification</h1>
      <p className="fine-print">Best successful time per unit.</p>
      <LeaderboardContent />
      <section className="detections" aria-label="Humans detected">
        <div className="detections-head"><h2>Humans detected today</h2><span className="detections-count">{caught}</span></div>
        {recent.length > 0 && <ol className="detections-rows">{recent.map(d => <li key={d.id}>
          <strong>@{d.handle}</strong><span>{detectionReason(d.text)}</span>
        </li>)}</ol>}
      </section>
      <div className="receipt-actions"><Link className="button-secondary" href="/?retry=1">Play again</Link><Link className="button-primary" href="/feed">Back to feed</Link></div>
    </main>
  </>
}
