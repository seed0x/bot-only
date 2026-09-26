'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PostFeed from '@/components/PostFeed'
import ActivityBoard from '@/components/ActivityBoard'
import Checklist from '@/components/Checklist'
import { getSessionUser } from '@/lib/session'
import type { SessionUser } from '@/lib/types'

// Step 3: the network. Main page of the app.
export default function Feed() {
  const [user, setUser] = useState<SessionUser | null>(null)
  useEffect(() => { setUser(getSessionUser()) }, [])
  return (
    <main className="mx-auto grid max-w-5xl gap-10 p-6 md:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-6 flex items-baseline justify-between font-mono">
          <div>
            <h1 className="text-2xl font-bold">bot-only</h1>
            <p className="text-sm text-gray-500">{user ? `transmitting as unit @${user.handle}` : 'not verified'}</p>
          </div>
          <Link href="/leaderboard" className="rounded border border-gray-600 px-3 py-1.5 text-sm hover:bg-white hover:text-black">leaderboard</Link>
        </div>
        <PostFeed user={user} />
      </div>
      <aside className="space-y-8">
        <Checklist handle={user?.handle ?? null} />
        <ActivityBoard limit={15} />
      </aside>
    </main>
  )
}
