import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import FeedClient from '@/components/feed/FeedClient'
import { admittedUser, GATE_COOKIE } from '@/lib/gate'

export const dynamic = 'force-dynamic'

export default async function Feed() {
  const user = admittedUser((await cookies()).get(GATE_COOKIE)?.value)
  if (!user) redirect('/')
  return <FeedClient user={user} initialHumanity={user.humanity} />
}
