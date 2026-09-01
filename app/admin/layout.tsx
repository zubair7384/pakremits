import type { Metadata } from 'next'
import { fonts } from '@/lib/fonts'
import '../globals.css'

/**
 * The admin area sits outside the locale tree — it is internal tooling, always
 * English, and never indexed — so it provides its own document shell rather
 * than inheriting one from [locale].
 */
export const metadata: Metadata = {
  title: 'Bhejo admin',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" dir="ltr" className={fonts}>
      <body>{children}</body>
    </html>
  )
}
