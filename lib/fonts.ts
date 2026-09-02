import { Bricolage_Grotesque, IBM_Plex_Sans, Noto_Nastaliq_Urdu } from 'next/font/google'
import localFont from 'next/font/local'

/**
 * Self-hosted by next/font at build time — no runtime requests to Google, no
 * layout shift, and nothing that would need a cookie banner.
 *
 * Shared between the locale layout and the admin layout so both document
 * shells get identical font variables from one definition.
 */
/**
 * 400/500/600/700 — checked against every font-weight utility and numeric
 * weight in app/ and components/. The original declaration also shipped 300 and
 * 800, which nothing uses.
 *
 * Tried dropping `weight` to pull the variable font instead: measured
 * identical total bytes and an identical Lighthouse score, because next/font
 * slices by unicode-range either way. Kept explicit, since these are the
 * weights the design actually asks for.
 */
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bricolage',
  display: 'swap',
})

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex',
  display: 'swap',
})

/**
 * Noto Nastaliq Urdu is 239kB — by far the largest asset on the site, and next
 * to the 555kB of JavaScript it is the biggest single lever on a mobile
 * Lighthouse score.
 *
 * `preload: false` drops the <link rel=preload>, so it is no longer requested
 * before the page needs it. What it buys is ordering — the 239kB no longer
 * competes with the CSS and the hero for early bandwidth, and `display: swap`
 * means nothing blocks on it.
 *
 * English pages do not fetch this face at all: the fixed Urdu strings there use
 * `.urdu-fixed` and the 92kB subset below. Urdu pages use it throughout.
 */
const nastaliq = Noto_Nastaliq_Urdu({
  subsets: ['arabic'],
  weight: ['400', '600'],
  variable: '--font-nastaliq',
  display: 'swap',
  preload: false,
})

/**
 * Nastaliq, subset to the fixed Urdu strings that appear on English pages: the
 * hero tagline from the design and the "اردو" switcher label.
 *
 * The full face is 233kB — after compression the single largest asset on the
 * site, larger than all the JavaScript combined, and woff2 cannot be squeezed
 * further by a CDN. English pages were paying all of it to render a couple of
 * fixed phrases. This subset is 92kB and covers exactly those.
 *
 * The shipped .woff2 still carries the glyphs for the old "بھیجو" wordmark,
 * which the PakRemits logo replaced. Harmless — a superset renders correctly —
 * but the next regeneration drops them, which is why they are not in the
 * --text string below.
 *
 * Regenerate with (fonttools in a venv):
 *   pyftsubset <full.woff2> --text="پیسے بھیجنے سے پہلے ریٹ چیک کریں اردو" \
 *     --output-file=lib/font-data/nastaliq-latin-pages.woff2 \
 *     --flavor=woff2 --layout-features='*' --no-hinting
 *
 * `--layout-features='*'` is not optional: drop it and Nastaliq's joining and
 * ligature rules go with it, rendering the words as disconnected letters.
 */
const nastaliqSubset = localFont({
  src: './font-data/nastaliq-latin-pages.woff2',
  variable: '--font-nastaliq-subset',
  display: 'swap',
  // Only three short phrases use it, and never above the fold on mobile.
  preload: false,
})

export const fonts =
  `${bricolage.variable} ${plex.variable} ${nastaliq.variable} ${nastaliqSubset.variable}`
