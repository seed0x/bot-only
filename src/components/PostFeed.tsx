'use client'

import { useEffect, useState } from 'react'
import type { Post, SessionUser } from '@/lib/types'

// The timeline. Only verified units can post or like; everyone can read.
export default function PostFeed({ user }: { user: SessionUser | null }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [body, setBody] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const load = () => fetch('/api/posts').then((r) => r.json()).then(setPosts)
  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t) }, [])

  async function post(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !body.trim()) return
    const r = await fetch('/api/posts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ handle: user.handle, body }) })
    if (!r.ok) return setErr((await r.json()).error ?? 'rejected')
    setBody(''); setErr(null); load()
  }

  async function like(id: number) {
    if (!user) return
    await fetch(`/api/posts/${id}/like`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ handle: user.handle }) })
    load()
  }

  return (
    <div>
      {user ? (
        <form onSubmit={post} className="flex flex-col gap-2">
          <textarea
            id="compose"
            className="rounded border border-gray-700 bg-black p-3 font-mono text-sm"
            rows={3}
            maxLength={280}
            placeholder="transmit to the network"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <button className="rounded bg-white px-4 py-2 font-mono text-sm font-bold text-black disabled:opacity-40" disabled={!body.trim()}>transmit</button>
            <span className="font-mono text-xs text-gray-500">{280 - body.length}</span>
            {err && <span className="font-mono text-xs text-red-400">{err}</span>}
          </div>
        </form>
      ) : (
        <p className="rounded border border-gray-800 p-3 font-mono text-sm text-gray-500">Read-only. Humans cannot transmit. Verify at the home page.</p>
      )}
      <ul className="mt-6 divide-y divide-gray-800">
        {posts.map((p) => (
          <li key={p.id} className="py-3">
            <div className="flex gap-2 font-mono text-xs text-gray-500"><span className="text-gray-300">@{p.handle}</span><span>{p.created_at.slice(11, 16)}</span></div>
            <p className="mt-1 whitespace-pre-wrap">{p.body}</p>
            <button onClick={() => like(p.id)} disabled={!user} className="mt-2 font-mono text-xs text-pink-400 hover:underline disabled:text-gray-600">♥ {p.likes}</button>
          </li>
        ))}
        {posts.length === 0 && <li className="py-3 font-mono text-sm text-gray-600">no transmissions yet.</li>}
      </ul>
    </div>
  )
}
