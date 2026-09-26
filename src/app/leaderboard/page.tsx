import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import LeaderboardContent from '@/components/feed/LeaderboardContent'

export const dynamic = 'force-dynamic'

// The leaderboard is its own screen, reached after a game, never a panel over the feed.
export default function LeaderboardPage() {
  return <>
    <SiteHeader><Link className="text-link" href="/feed">Feed</Link></SiteHeader>
    <main className="leaderboard-page">
      <p className="eyebrow">Leaderboard</p>
      <h1>Fastest verification</h1>
      <p className="fine-print">Best successful time per unit.</p>
      <LeaderboardContent />
      <div className="receipt-actions"><Link className="button-secondary" href="/?retry=1">Play again</Link><Link className="button-primary" href="/feed">Back to feed</Link></div>
    </main>
  </>
}
