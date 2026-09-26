'use client'

import { useMemo, useRef, useState } from 'react'
import type { CaptchaResult } from '@/lib/types'

// Reproduce a 40-char hash within the limit. Machines copy. Humans type, and make mistakes.
export const HASH_LIMIT_MS = 4000

function randomHash() {
  const a = new Uint8Array(20); crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}

export default function HashRecall({ onResult }: { onResult: (r: CaptchaResult) => void }) {
  const hash = useMemo(randomHash, [])
  const [value, setValue] = useState('')
  const [done, setDone] = useState<{ passed: boolean; text: string } | null>(null)
  const t0 = useRef<number | null>(null)
  const pasted = useRef(false)

  function change(v: string) {
    if (done) return
    if (t0.current === null) t0.current = performance.now()
    setValue(v)
    if (v.length >= 40) finish(v)
  }

  function finish(v: string) {
    const ms = Math.round(performance.now() - (t0.current ?? performance.now()))
    let errors = 0
    for (let i = 0; i < 40; i++) if (v[i] !== hash[i]) errors++
    const passed = errors === 0 && ms <= HASH_LIMIT_MS
    const score = Math.min(1, (errors / 8) * 0.6 + (ms / (HASH_LIMIT_MS * 2)) * 0.4)
    const text = errors > 0
      ? `${errors} wrong character${errors > 1 ? 's' : ''}. Machines do not mistype.`
      : ms > HASH_LIMIT_MS
        ? `Correct, but ${(ms / 1000).toFixed(1)}s. Machines do not read.`
        : `Exact in ${(ms / 1000).toFixed(2)}s. ${pasted.current ? 'Copied, as a machine would.' : 'Typed. Suspiciously fast.'}`
    setDone({ passed, text })
    onResult({ challenge: 'hash-recall', passed, score, duration_ms: ms, meta: { errors, pasted: pasted.current, reason: text } })
  }

  const elapsed = t0.current === null ? 0 : performance.now() - t0.current
  return (
    <div className="font-mono">
      <div className="select-all break-all rounded-md border px-3 py-2 text-[13px] tracking-wider" style={{ borderColor: 'var(--line)', background: 'var(--surface-2)' }}>{hash}</div>
      <input
        id="hash-input"
        autoFocus
        disabled={!!done}
        value={value}
        onChange={(e) => change(e.target.value)}
        onPaste={() => { pasted.current = true }}
        placeholder="reproduce it here"
        spellCheck={false}
        autoComplete="off"
        className="mt-2 w-full rounded-md border bg-transparent px-3 py-2 text-[13px] tracking-wider outline-none disabled:opacity-60"
        style={{ borderColor: 'var(--line)' }}
      />
      <div className="mt-2 flex items-center justify-between text-xs" style={{ color: 'var(--muted)' }}>
        <span>{value.length}/40 · limit {HASH_LIMIT_MS / 1000}s</span>
        {done && <span style={{ color: done.passed ? 'var(--verified)' : 'var(--danger)' }}>{done.passed ? 'VERIFIED NON-HUMAN' : 'HUMAN DETECTED'} · {done.text}</span>}
        {!done && elapsed > 0 && <span>running</span>}
      </div>
    </div>
  )
}
