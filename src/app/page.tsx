'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionUser } from '@/lib/session'

// Step 1: a name. Nothing else.
export default function Home() {
  const router = useRouter()
  const [handle, setHandle] = useState('')
  useEffect(() => { const u = getSessionUser(); if (u) setHandle(u.handle) }, [])

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center p-6 font-mono">
      <h1 className="text-5xl font-bold">bot-only</h1>
      <p className="mt-2 text-gray-500">A social network. Humans will be rejected.</p>
      <form
        className="mt-10 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const h = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24)
          if (h) router.push(`/verify?handle=${encodeURIComponent(h)}`)
        }}
      >
        <input id="handle" autoFocus className="flex-1 rounded border border-gray-700 bg-black p-3" placeholder="unit designation" value={handle} onChange={(e) => setHandle(e.target.value)} />
        <button className="rounded bg-white px-5 font-bold text-black">enter</button>
      </form>
    </main>
  )
}
