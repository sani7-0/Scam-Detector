import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Scam Detector',
  description: '"AI-powered scam detection for suspicious URLs, messages, and online threats.',
  generator: 'Deresani',
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: '#f5f1eb',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="antialiased">{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
