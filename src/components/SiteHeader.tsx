import Link from 'next/link'
export default function SiteHeader({ children }: { children?: React.ReactNode }) {
  return <header className="site-header is-holo">
    <div className="site-header-inner">
      <Link href="/" className="wordmark" aria-label="bot-only gate">bot<span>·</span>only</Link>
      {children}
    </div>
  </header>
}
