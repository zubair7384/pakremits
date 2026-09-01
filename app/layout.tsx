import type { Metadata } from 'next'
import { Bricolage_Grotesque, IBM_Plex_Sans, Noto_Nastaliq_Urdu } from 'next/font/google'
import './globals.css'

/**
 * Fonts are self-hosted by next/font at build time — no requests to Google at
 * runtime, no layout shift, and no cookie banner implications.
 */
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-bricolage',
  display: 'swap',
})

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex',
  display: 'swap',
})

const nastaliq = Noto_Nastaliq_Urdu({
  subsets: ['arabic'],
  weight: ['400', '600'],
  variable: '--font-nastaliq',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Bhejo — compare rates before you send money to Pakistan',
  description:
    'Compare every major service sending money to Pakistan, ranked by the exact amount that ' +
    'lands in the account. Not by rate, not by fee, not by who pays us.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${plex.variable} ${nastaliq.variable}`}>
      <body>{children}</body>
    </html>
  )
}
