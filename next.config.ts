import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

// Points next-intl at i18n/request.ts. Required even though we handle locale
// routing ourselves through the rewrite table below.
const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/**
 * URL mapping.
 *
 * Two things are happening here, both of which exist because the URLs we want
 * to publish do not match the shape Next's file router can express.
 *
 * 1. **Pretty URLs.** Next dynamic segments must be a whole path segment, so
 *    `send-money-from-[slug]-to-pakistan` is not expressible as a folder. The
 *    pages live at `/corridor/[slug]`, `/rate/[currency]` and `/method/[slug]`,
 *    and these rewrites expose the public form. robots.txt disallows the
 *    internal forms so the two never compete for the same ranking signal.
 *
 * 2. **An unprefixed default locale.** Pages live under `/[locale]`, but
 *    English must be served from the root — `/gbp-to-pkr`, not `/en/gbp-to-pkr`.
 *
 * Everything is in `beforeFiles` and every English path is listed explicitly.
 * A catch-all `/:path*` → `/en/:path*` would be shorter but wrong: it runs
 * after route matching, and `/how-we-rank` already matches `/[locale]` with
 * locale="how-we-rank", so it would never reach the rewrite. Listing the paths
 * is verbose and obvious, which beats short and subtly broken.
 *
 * Adding a page therefore means adding a line here. That is the cost of clean
 * URLs plus an unprefixed default locale, and it is worth it.
 */
const nextConfig: NextConfig = {
  async redirects() {
    return [
      /**
       * The rewrites below serve English from the root by pointing at `/en`
       * internally, which leaves `/en/...` externally reachable and serving
       * identical content. Redirect it away permanently so the two forms never
       * compete.
       *
       * Safe against the rewrites: redirects run before `beforeFiles`, and the
       * internal result of a rewrite is not fed back through them.
       */
      { source: '/en', destination: '/', permanent: true },
      { source: '/en/:path*', destination: '/:path*', permanent: true },
    ]
  },

  async rewrites() {
    return {
      beforeFiles: [
        // ─── Pretty URLs, English ────────────────────────────────────────
        { source: '/send-money-from-:slug-to-pakistan', destination: '/en/corridor/:slug' },
        { source: '/roshan-digital-account-transfer', destination: '/en/method/rda' },
        { source: '/send-money-to-:slug', destination: '/en/method/:slug' },
        { source: '/:currency-to-pkr', destination: '/en/rate/:currency' },

        // ─── Pretty URLs, Urdu ───────────────────────────────────────────
        { source: '/ur/send-money-from-:slug-to-pakistan', destination: '/ur/corridor/:slug' },
        { source: '/ur/roshan-digital-account-transfer', destination: '/ur/method/rda' },
        { source: '/ur/send-money-to-:slug', destination: '/ur/method/:slug' },
        { source: '/ur/:currency-to-pkr', destination: '/ur/rate/:currency' },

        // ─── Unprefixed English routes ───────────────────────────────────
        { source: '/', destination: '/en' },
        { source: '/how-we-rank', destination: '/en/how-we-rank' },
        { source: '/providers', destination: '/en/providers' },
        { source: '/providers/:slug', destination: '/en/providers/:slug' },
        { source: '/compare/:pair', destination: '/en/compare/:pair' },
        { source: '/about', destination: '/en/about' },
        { source: '/contact', destination: '/en/contact' },
        { source: '/privacy', destination: '/en/privacy' },
        { source: '/affiliate-disclosure', destination: '/en/affiliate-disclosure' },
      ],
    }
  },
}

export default withNextIntl(nextConfig)
