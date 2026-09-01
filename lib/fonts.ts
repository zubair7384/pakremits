import { Bricolage_Grotesque, IBM_Plex_Sans, Noto_Nastaliq_Urdu } from 'next/font/google'

/**
 * Self-hosted by next/font at build time — no runtime requests to Google, no
 * layout shift, and nothing that would need a cookie banner.
 *
 * Shared between the locale layout and the admin layout so both document
 * shells get identical font variables from one definition.
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

export const fonts = `${bricolage.variable} ${plex.variable} ${nastaliq.variable}`
