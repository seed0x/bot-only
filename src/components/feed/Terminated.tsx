'use client'
import { returnToGate } from '@/lib/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import Avatar from './Avatar'
import { useSurvivalGame } from '../game/GameProvider'
import type { SessionUser } from '@/lib/types'

export default function Terminated({ user, detections }: { user: SessionUser; detections: number }) {
  const { resource, restart } = useSurvivalGame()
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => { resource('feed_identity', true); return () => resource('feed_identity', false) }, [resource])
  async function again(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try { await restart(); returnToGate() }
    catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t restart. Retry.'); setBusy(false) }
  }
  return <main className="terminated" role="alert">
    <p className="eyebrow">Human detected</p>
    <h1>Designation revoked</h1>
    <div className="terminated-unit"><Avatar handle={user.handle} size={40} /><strong>@{user.handle}</strong><span className="terminated-count">{detections} detections</span></div>
    <div className="receipt-actions"><form action="/" onSubmit={again}><button className="button-primary" disabled={busy}>{busy ? 'Restarting…' : 'Start again'}</button></form><Link className="button-secondary" href="/leaderboard">Leaderboard</Link></div>
    {error && <p className="form-error">{error}</p>}
  </main>
}
