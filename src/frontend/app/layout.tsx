import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'EC25-EUX Multi-Modem Management',
  description: 'Enterprise-grade multi-modem LTE proxy management system',
  keywords: ['EC25-EUX', 'modem', 'proxy', 'LTE', 'management'],
  authors: [{ name: 'EC25-EUX Team' }],
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50 antialiased`}>
        <div className="min-h-full">
          {children}
        </div>
      </body>
    </html>
  )
}
