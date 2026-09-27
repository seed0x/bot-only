'use client'
import Link from 'next/link'
import { useSurvivalGame } from './game/GameProvider'
export default function SiteHeader({ children }: { children?: React.ReactNode }) {
  const { openLeaderboard } = useSurvivalGame()
  return <header className="site-header is-holo">
    <div className="site-header-inner">
      <Link href="/" className="wordmark" aria-label="bot-only gate">bot<span>·</span>only</Link>
      {children}
      <button className="text-button" onClick={openLeaderboard}>Leaderboard</button>
    </div>
  </header>
}
