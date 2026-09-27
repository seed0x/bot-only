'use client'
import { returnToGate } from '@/lib/navigation'
import Link from 'next/link'
import LeaderboardContent from '@/components/feed/LeaderboardContent'
import LongestRuns from '@/components/feed/LongestRuns'
import { useEffect, useRef, useState } from 'react'
import SiteHeader from '@/components/SiteHeader'
import { useSurvivalGame } from './GameProvider'

export default function GameOver() {
  const { state, saveState, saveError, saveResult, restart } = useSurvivalGame()
  const heading = useRef<HTMLHeadingElement>(null)
  const [restarting, setRestarting] = useState(false), [error, setError] = useState('')
  const result = state.terminal
  useEffect(() => { if (result) heading.current?.focus() }, [result])
  if (!result) return null
  async function again(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (restarting) return
    setRestarting(true); setError('')
    try { await restart(); returnToGate() }
    catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t restart. Retry.'); setRestarting(false) }
  }
  return <>
    <SiteHeader />
    <main className={`session-ended game-result${result.status === 'failed' ? ' is-failed' : ''}`}>
      <p className="eyebrow">{state.user ? `@${state.user.handle}` : 'onlybots'}</p>
      <h1 ref={heading} tabIndex={-1}>{result.status === 'interrupted' ? 'Run ended.' : 'Human detected.'}</h1>
      {result.status === 'failed' && <p className="muted">{result.measurements[0]?.explanation}</p>}
      <dl className="game-result-metrics">
        <div><dt>Time survived</dt><dd>{(result.activeMs / 1000).toFixed(2)}<small>s</small></dd></div>
        <div><dt>Objectives</dt><dd>{result.completedObjectiveIds.length}</dd></div>
      </dl>
      <p className="fine-print" role="status">{saveState === 'saved' ? 'Result saved.' : saveState === 'error' ? 'Result not saved.' : 'Saving result…'}{result.status === 'interrupted' && ' Ended runs are not ranked.'}</p>
      {saveError && <div role="alert"><p className="form-error">{saveError}</p><button className="button-secondary" onClick={() => void saveResult().catch(() => {})}>Retry saving</button></div>}
      <section className="end-board" aria-label="Leaderboard"><h2>Fastest verification</h2><LeaderboardContent limit={10} /><h2>Longest run</h2><LongestRuns /></section>
      <section className="end-board" aria-label="Leaderboard"><h2>Fastest verification</h2><LeaderboardContent limit={10} /><h2>Longest run</h2><LongestRuns /></section>
    <div className="receipt-actions">
        <form action="/" onSubmit={again}><button className="button-primary" disabled={restarting || saveState !== 'saved'}>{restarting ? 'Restarting…' : 'Start again'}</button></form>
        <Link className="button-secondary" href="/leaderboard">Leaderboard</Link>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </main>
  </>
}
