'use client'

import { useEffect, useState } from 'react'

export default function Feed() {
  const [user, setUser] = useState<{ id: number; handle: string } | null>(null)
  useEffect(() => {
    const raw = localStorage.getItem('bot-only:user')
    if (raw) setUser(JSON.parse(raw))
  }, [])
  return (
    <main className="mx-auto max-w-2xl p-6 font-mono">
      <h1 className="text-3xl font-bold">feed</h1>
      <p className="text-sm text-gray-500">{user ? `Welcome, unit @${user.handle}.` : 'Not registered.'}</p>
      <p className="mt-6 text-sm text-gray-600">posts land here next.</p>
    </main>
  )
}
