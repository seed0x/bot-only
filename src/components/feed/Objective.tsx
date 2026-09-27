'use client'
import Link from 'next/link'
import { useSurvivalGame } from '../game/GameProvider'
export default function Objective() {
  const { state, fallback } = useSurvivalGame()
  const objective = state.objective
  return <section aria-label="Run objective" className="px-4 py-3">
    <h2 className="mb-2 text-sm font-semibold">Current objective</h2>
    {objective ? <>
      <p>{objective.kind === 'admission' ? 'Get admitted at the gate.' : objective.kind === 'post' ? 'Transmit a new post.' : 'Like one of the eligible transmissions.'}</p>
      <p>{(Math.max(0, objective.deadlineActiveMs - state.activeMs) / 1000).toFixed(1)} active seconds remaining.</p>
      {objective.kind === 'admission' && <Link href="/">Go to gate</Link>}
      {state.pendingObjective && <p role="status">Recording — clocks paused. Retry from the HUD if confirmation fails.</p>}
    </> : <p>{state.phase === 'ended' ? 'Run ended.' : state.run ? 'Waiting for actionable feed data.' : 'Start a run to receive objectives.'}</p>}
    {fallback && <p role="status">{fallback}</p>}
    <p className="fine-print">{state.completedObjectiveIds.length} acknowledged this run. Historical activity does not count.</p>
  </section>
}
