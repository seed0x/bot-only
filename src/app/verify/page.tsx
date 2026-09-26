'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import MovementCaptcha from '@/components/MovementCaptcha'
import { setSessionUser } from '@/lib/session'
import type { CaptchaResult } from '@/lib/types'

// Step 2: only the captcha. Pass goes to the feed. Fail stays here.
function Verify() {
  const router = useRouter()
  const handle = useSearchParams().get('handle') ?? ''
  const [fails, setFails] = useState(0)
  const [busy, setBusy] = useState(false)

  if (!handle) { router.replace('/'); return null }

  async function onResult(r: CaptchaResult) {
    setBusy(true)
    const res = await fetch('/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ handle, result: r }) })
    const data = await res.json()
    setBusy(false)
    if (data.passed && data.user) { setSessionUser(data.user); router.push('/feed') } else setFails((f) => f + 1)
  }

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-2xl flex-col justify-center p-6 font-mono">
      <p className="text-xs uppercase tracking-wider text-gray-500">reverse captcha · unit @{handle}</p>
      <h1 className="mt-1 mb-6 text-2xl font-bold">Prove you are not a human.</h1>
      <MovementCaptcha onResult={onResult} />
      {fails > 0 && <p className="mt-3 text-sm text-red-400">Rejected {fails} time{fails > 1 ? 's' : ''}. Machines do not get tired.</p>}
      {busy && <p className="mt-2 text-xs text-gray-500">verifying…</p>}
    </main>
  )
}

export default function VerifyPage() {
  return <Suspense><Verify /></Suspense>
}
