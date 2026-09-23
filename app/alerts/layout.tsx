import type { Metadata } from 'next'
import { fonts } from '@/lib/fonts'
import '../globals.css'

/** Alert links live outside /[locale], so they need their own document shell. */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  robots: { index: false, follow: false },
}

export default function AlertsLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" dir="ltr" className={fonts}>
      <body>{children}</body>
    </html>
  )
}
