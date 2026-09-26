'use client'
export default function FeedError({ reset }: { reset: () => void }) {
  return <main className="gate-layout"><section className="trial-pending" role="alert">
    <h1 className="access-error-title">Couldn’t open the feed</h1>
    <p>Your access could not be checked. Try again.</p>
    <button className="button-secondary" onClick={reset}>Try again</button>
  </section></main>
}
