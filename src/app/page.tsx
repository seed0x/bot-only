import GateClient from '@/components/GateClient'

export const dynamic = 'force-dynamic'

// Every visit to the gate starts from nothing. No one is remembered.
export default function Home() {
  return <GateClient />
}
