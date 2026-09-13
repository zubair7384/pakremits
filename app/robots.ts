import type { MetadataRoute } from 'next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api/',
          // Affiliate redirects. These mint a tracking id per request, so
          // crawling them would fill the clicks table with bot traffic and
          // corrupt the reporting the whole business model depends on.
          '/go/',
          // Alert URLs are capability tokens. Indexing one would publish it.
          '/alerts/',
          // The internal paths behind the pretty-URL rewrites. Indexing both
          // forms would split the ranking signal between duplicates.
          '/corridor/',
          '/rate/',
          '/method/',
          '/ur/corridor/',
          '/ur/rate/',
          '/ur/method/',
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  }
}
