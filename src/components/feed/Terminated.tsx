'use client'
import Link from 'next/link'
import Avatar from './Avatar'
import type { SessionUser } from '@/lib/types'

// The run is over. The designation is revoked and the unit leaves the floor.
export default function Terminated({ user, detections }: { user: SessionUser; detections: number }) {
  return <main className="terminated" role="alert">
    <p className="eyebrow">Human detected</p>
    <h1>Designation revoked</h1>
    <div className="terminated-unit"><Avatar handle={user.handle} size={40} /><strong>@{user.handle}</strong><span className="terminated-count">{detections} detections</span></div>
    <div className="receipt-actions"><Link className="button-primary" href="/leaderboard">Leaderboard</Link><Link className="button-secondary" href="/?retry=1">New designation</Link></div>
  </main>
}
