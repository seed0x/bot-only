import { randomInt } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import GateClient from '@/components/GateClient'
import { admittedUser, GATE_COOKIE } from '@/lib/gate'

export const dynamic = 'force-dynamic'

export default async function Home({ searchParams }: { searchParams: Promise<{ retry?: string | string[] }> }) {
  const user = admittedUser((await cookies()).get(GATE_COOKIE)?.value)
  const retry = (await searchParams).retry === '1'
  if (user && !retry) redirect('/feed')
  const designation = Array.from({ length: 7 }, () => 'abcdefghijklmnopqrstuvwxyz'[randomInt(26)]).join('') + '-' + String(randomInt(1_000_000)).padStart(6, '0')
  return <GateClient initialUser={user} initialDesignation={designation} />
}
