'use client'
import { useState } from 'react'
import Avatar from './Avatar'
import ResourceState from '@/components/ResourceState'
import { usePollingResource } from '@/hooks/usePollingResource'
import { formatSurvivalSeconds, isSurvivalScores, SURVIVAL_INPUT_MODES, SURVIVAL_STAGE_LABELS } from '@/lib/survival/scores'
import type { SurvivalInputMode } from '@/lib/types'

export default function LeaderboardContent({ active = true, limit }: { active?: boolean; limit?: number }) {
  const [mode, setMode] = useState<SurvivalInputMode>('pointer')
  const { data, error, loading, refresh } = usePollingResource(active ? `/api/scores?inputMode=${mode}` : null, isSurvivalScores, 5000)
  const scores = data?.scores
  return <>
    <div className="mode-switch" role="group" aria-label="Input mode">
      {SURVIVAL_INPUT_MODES.map(m => <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</button>)}
    </div>
    {loading && <ResourceState title="Loading rankings…" busy />}
    {error && <ResourceState title={scores ? 'Rankings paused' : 'Rankings unavailable'} detail={scores ? 'Showing the last confirmed rankings.' : undefined} retry={refresh} />}
    {scores?.length === 0 && <ResourceState title="No runs yet" detail="Completed runs will appear here." />}
    {!!scores?.length && <ol className="leaderboard-rows">{(limit ? scores.slice(0, limit) : scores).map((r, i) => <li key={r.runId}>
      <span className="rank-number">{String(i + 1).padStart(2, '0')}</span><Avatar handle={r.handle} size={32} />
      <div className="rank-unit"><strong>@{r.handle}</strong><span className="eyebrow">{SURVIVAL_STAGE_LABELS[r.stage]} · {r.completedObjectives} {r.completedObjectives === 1 ? 'objective' : 'objectives'} · {r.roundsSurvived} {r.roundsSurvived === 1 ? 'round' : 'rounds'}</span></div>
      <span className="rank-score">{formatSurvivalSeconds(r.activeMs)}<small>s</small></span>
    </li>)}</ol>}
  </>
}
