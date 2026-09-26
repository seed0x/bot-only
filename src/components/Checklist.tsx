'use client'

import { useEffect, useState } from 'react'
import type { Progress } from '@/lib/types'

// The challenges a unit must beat. Reads /api/progress for the given handle.
export default function Checklist({ handle }: { handle: string | null }) {
  const [items, setItems] = useState<Progress[]>([])
  useEffect(() => {
    fetch(`/api/progress?handle=${encodeURIComponent(handle ?? '')}`).then((r) => r.json()).then(setItems)
  }, [handle])
  const done = items.filter((i) => i.passed).length
  return (
    <div className="font-mono text-sm">
      <div className="mb-2 flex justify-between uppercase tracking-wider text-gray-500">
        <span>challenges</span><span>{done}/{items.length}</span>
      </div>
      <ul className="space-y-1">
        {items.map((c) => (
          <li key={c.id} className={`flex items-baseline gap-2 ${c.live ? '' : 'opacity-40'}`}>
            <span className={c.passed ? 'text-green-400' : 'text-gray-600'}>{c.passed ? '[x]' : '[ ]'}</span>
            <span className="text-gray-200">{c.name}</span>
            <span className="truncate text-gray-500">{c.hint}</span>
            {!c.live && <span className="ml-auto text-gray-600">soon</span>}
            {c.passed && c.best_score !== null && <span className="ml-auto text-gray-500">{c.best_score.toFixed(2)}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
