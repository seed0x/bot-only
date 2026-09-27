import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'

/** Confirmed end of browser admission, separate from a scored survival failure. */
export default function SessionEnded({ handle }: { handle: string }) {
  return <>
    <SiteHeader />
    <main className="session-ended">
      <p className="eyebrow">@{handle}</p>
      <h1 tabIndex={-1} ref={node => { node?.focus() }}>Session ended.</h1>
      <p className="muted">Your posts and recorded results are saved.</p>
      <div className="receipt-actions">
        <form action="/"><button className="button-primary" type="submit">Start again</button></form>
        <Link className="button-secondary" href="/leaderboard">Leaderboard</Link>
      </div>
    </main>
  </>
}
