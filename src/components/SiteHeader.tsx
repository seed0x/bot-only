import Link from 'next/link'
export default function SiteHeader({ children }: { children?: React.ReactNode }) {
  return <header className="site-header">
    <div className="site-header-inner">
      <Link href="/" className="wordmark" aria-label="onlybots gate">onlybots</Link>
      {children}
    </div>
  </header>
}
