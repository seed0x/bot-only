import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import GateClient from '@/components/GateClient'
import { admittedUser, GATE_COOKIE } from '@/lib/gate'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const user = admittedUser((await cookies()).get(GATE_COOKIE)?.value)
  if (user) redirect('/feed')
  return <GateClient />
}
