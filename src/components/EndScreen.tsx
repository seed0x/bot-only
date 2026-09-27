'use client'
import SiteHeader from '@/components/SiteHeader'
import LeaderboardContent from '@/components/feed/LeaderboardContent'
import LongestRuns from '@/components/feed/LongestRuns'

// The one end screen: a verdict, the live top ten, and the way back in.
export default function EndScreen({ eyebrow, title, detail, failed = false, children }: { eyebrow: string; title: string; detail?: React.ReactNode; failed?: boolean; children?: React.ReactNode }) {
  return <>
    <SiteHeader />
    <main className={`session-ended game-result${failed ? ' is-failed' : ''}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h1 tabIndex={-1} ref={node => { node?.focus() }}>{title}</h1>
      {detail}
      <section className="end-board" aria-label="Leaderboard">
        <h2>Longest run</h2><LongestRuns />
        <h2>Fastest verification</h2><LeaderboardContent limit={10} />
      </section>
      {children && <div className="receipt-actions">{children}</div>}
    </main>
  </>
}
