'use client'
import Link from 'next/link'
import { useSurvivalGame } from '../game/GameProvider'

// The current objective of the run and its deadline. Nothing else.
export default function Objective() {
  const { state, fallback } = useSurvivalGame()
  const objective = state.objective
  return <section aria-label="Run objective" className="objectives-panel">
    <div className="objectives-heading"><h2>Objective</h2>{objective && <span>{(Math.max(0, objective.deadlineActiveMs - state.activeMs) / 1000).toFixed(1)}s</span>}</div>
    {objective ? <div className="objective-body">
      <p className="objective-text">{objective.kind === 'admission' ? 'Get admitted at the gate.' : objective.kind === 'post' ? 'Transmit once.' : 'Like a transmission.'}</p>
      {objective.kind === 'admission' && <Link className="text-link" href="/">Gate</Link>}
      {state.pendingObjective && <p className="fine-print" role="status">Recording…</p>}
    </div> : <p className="objective-text">{state.phase === 'ended' ? 'Run over.' : state.run ? 'Waiting for the feed.' : 'Start a run.'}</p>}
    {fallback && <p className="fine-print" role="status">{fallback}</p>}
    <p className="fine-print">{state.completedObjectiveIds.length} completed this run</p>
  </section>
}
