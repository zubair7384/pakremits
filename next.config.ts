import type { NextConfig } from 'next'

/**
 * Next.js dynamic segments have to be a whole path segment — `[slug]` works,
 * `send-money-from-[slug]-to-pakistan` does not. The brief specifies the latter
 * as the public URL, and it is the better URL for search, so the pages live at
 * /corridor/[slug] internally and these rewrites expose the pretty form.
 *
 * Rewrites, not redirects: the pretty URL stays in the address bar and is what
 * every canonical tag, sitemap entry, and internal link points at. The internal
 * path is an implementation detail that should never be linked directly.
 */
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/send-money-from-:slug-to-pakistan',
        destination: '/corridor/:slug',
      },
      {
        source: '/ur/send-money-from-:slug-to-pakistan',
        destination: '/ur/corridor/:slug',
      },
      // Same reason: /gbp-to-pkr is the URL people search for and link to.
      {
        source: '/:currency-to-pkr',
        destination: '/rate/:currency',
      },
      {
        source: '/ur/:currency-to-pkr',
        destination: '/ur/rate/:currency',
      },
      // Method pages. The RDA one gets its own source because the natural URL
      // for it is not "send money to a Roshan Digital Account".
      {
        source: '/send-money-to-:slug',
        destination: '/method/:slug',
      },
      {
        source: '/roshan-digital-account-transfer',
        destination: '/method/rda',
      },
    ]
  },
}

export default nextConfig
