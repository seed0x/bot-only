import { useEffect, useState } from 'react'

type Attempt = { id: number; name: string; challenge: string; passed: number; score: number; created_at: string }

export default function App() {
  const [attempts, setAttempts] = useState<Attempt[]>([])

  async function load() {
    const r = await fetch('/api/attempts')
    setAttempts(await r.json())
  }
  useEffect(() => { load(); const t = setInterval(load, 2000); return () => clearInterval(t) }, [])

  async function test() {
    await fetch('/api/attempts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'human', challenge: 'smoke', passed: false, score: 0 }),
    })
    load()
  }

  return (
    <main className="mx-auto max-w-xl p-6 font-mono">
      <h1 className="text-3xl font-bold">bot-only</h1>
      <p className="text-sm text-gray-500">Humans will be rejected.</p>
      <button onClick={test} className="mt-4 rounded bg-black px-4 py-2 text-white">record a failure</button>
      <ul className="mt-6 space-y-1 text-sm">
        {attempts.map((a) => (
          <li key={a.id}>{a.created_at} · {a.name} · {a.challenge} · {a.passed ? 'PASS' : 'FAIL'} · {a.score}</li>
        ))}
      </ul>
    </main>
  )
}
