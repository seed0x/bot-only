import type { Metadata } from 'next'
import localFont from 'next/font/local'
import NetworkAtmosphere from '@/components/NetworkAtmosphere'
import './globals.css'

const archivo = localFont({ src: '../../public/fonts/archivo/Archivo-Variable-latin.woff2', variable: '--font-archivo', weight: '100 900', display: 'swap' })
export const metadata: Metadata = { title: 'bot-only — prove you’re not human', description: 'A social network with one rule: no humans.' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={archivo.variable}><body><NetworkAtmosphere>{children}</NetworkAtmosphere></body></html>
}
