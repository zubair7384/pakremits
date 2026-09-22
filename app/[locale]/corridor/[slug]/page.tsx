/**
 * Corridor pages — the SEO core.
 *
 * Public URL is /send-money-from-[slug]-to-pakistan, mapped here by a rewrite
 * in next.config.ts because Next cannot express a partial dynamic segment.
 * Every canonical, sitemap entry and internal link uses the public form; this
 * path should never be linked directly.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ComparePanel } from '@/components/compare-panel'
import { RateChart } from '@/components/rate-chart'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { alternatesFor, isLocale } from '@/i18n/routing'
import {
  CORRIDORS,
  CURRENCY_SYMBOLS,
  defaultAmountFor,
  corridorBySlug,
  formatSend,
} from '@/lib/corridors'
import { CORRIDOR_CONTENT } from '@/lib/content/corridors'
import { formatPkr } from '@/lib/ranking/compute'
import { getComparison, getMidMarketSeries } from '@/lib/quotes'
import { publicPageMetadata } from '@/lib/seo'

export const revalidate = 900

/** All eight corridors are known at build time, so prerender the lot. */
export function generateStaticParams() {
  return CORRIDORS.map((corridor) => ({ slug: corridor.slug }))
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/** The public URL for a corridor, which is what everything must point at. */
export function corridorPath(slug: string): string {
  return `/send-money-from-${slug}-to-pakistan`
}

const TODAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale: localeParam, slug } = await params
  if (!isLocale(localeParam)) notFound()
  const corridor = corridorBySlug(slug)
  if (!corridor) return {}

  const content = CORRIDOR_CONTENT[corridor.fromCurrency]
  const path = corridorPath(slug)

  return publicPageMetadata({
    title: `Send money from ${corridor.articleName} to Pakistan: compare rates | PakRemits`,
    description: content.metaDescription,
    path,
    alternates: alternatesFor(path),
    type: 'article',
    image: `/og/corridor/${slug}.png`,
  })
}

export default async function CorridorPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: localeParam, slug } = await params
  const locale = isLocale(localeParam) ? localeParam : notFound()
  setRequestLocale(locale)
  const tCommon = await getTranslations({ locale, namespace: 'common' })
  const corridor = corridorBySlug(slug)
  if (!corridor) notFound()

  const content = CORRIDOR_CONTENT[corridor.fromCurrency]
  const symbol = CURRENCY_SYMBOLS[corridor.fromCurrency]

  const [comparison, series] = await Promise.all([
    getComparison({ corridorSlug: slug, method: 'bank' }),
    getMidMarketSeries(corridor.fromCurrency, 30),
  ])

  const corridorOptions = CORRIDORS.map((c) => ({
    slug: c.slug,
    countryCode: c.fromCountry,
    countryName: c.fromCountryName,
    currency: c.fromCurrency,
    symbol: CURRENCY_SYMBOLS[c.fromCurrency],
    defaultAmount: defaultAmountFor(c.fromCurrency),
  }))

  const path = corridorPath(slug)
  const saving = comparison?.savingVsBank ?? null

  return (
    <>
      <SiteHeader locale={locale} />

      <main>
        <div className="bg-green px-0 pt-10 pb-28 text-mist">
          <div className="mx-auto max-w-[1120px] px-6">
            <nav aria-label="Breadcrumb" className="text-[13px] text-[#99B3A6]">
              <ol className="flex flex-wrap items-center gap-2">
                <li>
                  <Link href="/" className="no-underline hover:text-white">
                    PakRemits
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li className="text-[#C9D9D0]">{corridor.fromCountryName} to Pakistan</li>
              </ol>
            </nav>

            <h1 className="mt-5 max-w-[18ch] text-[clamp(34px,4.6vw,54px)] leading-[1.05] font-semibold">
              {content.title}
            </h1>

            <div className="mt-5 max-w-[58ch] space-y-4 text-[17px] text-[#C9D9D0]">
              {content.intro.map((paragraph) => (
                <p key={paragraph.slice(0, 32)}>{paragraph}</p>
              ))}
            </div>

            {saving !== null && (
              <p className="mt-6 text-[15px] text-[#B2C6BC]">
                Right now the best service on this page beats a typical high-street bank by{' '}
                <b className="font-medium text-gold">{formatPkr(saving)}</b> on{' '}
                {formatSend(symbol, comparison?.amount ?? 0)}.
              </p>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-[1120px] px-6">
          {comparison ? (
            <ComparePanel initial={comparison} corridors={corridorOptions} />
          ) : (
            <section className="relative -mt-20 rounded-panel-lg border border-line bg-white p-10">
              <h2 className="font-display text-xl font-semibold">No quotes yet</h2>
              <p className="mt-2 text-muted">
                We have no live quotes for this corridor at the moment. The refresh runs every 15
                minutes.
              </p>
            </section>
          )}

          {/* 30-day chart */}
          <section className="mt-16">
            <RateChart
              points={series.points}
              currency={corridor.fromCurrency}
              label={`${corridor.fromCurrency} to PKR, last 30 days`}
            />
          </section>

          {/* Editorial */}
          <div className="mt-16 grid gap-12 lg:grid-cols-[1fr_300px]">
            <article className="max-w-[68ch]">
              {locale === 'ur' && (
                /* The long-form guidance is English-only for now. Machine
                   translating several thousand words of financial guidance
                   would be worse than saying so plainly. */
                <p className="mb-6 rounded-panel border border-line bg-white p-4 text-[14.5px] text-muted">
                  {tCommon('translationPending')}
                </p>
              )}
              {content.sections.map((section) => (
                <section key={section.heading} className="mb-10">
                  <h2 className="text-[26px] leading-tight font-semibold">{section.heading}</h2>
                  <div className="mt-3 space-y-4 text-[16.5px] text-muted">
                    {section.body.map((paragraph) => (
                      <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              ))}

              <section id="faq" className="mt-12">
                <h2 className="text-[26px] leading-tight font-semibold">Common questions</h2>
                <div className="mt-5 border-t border-line">
                  {content.faqs.map((faq, index) => (
                    <details key={faq.q} open={index === 0} className="group border-b border-line">
                      <summary
                        className="flex cursor-pointer list-none items-center justify-between gap-4
                                   py-5 text-[17px] font-medium faq-summary"
                      >
                        {faq.q}
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="h-4.5 w-4.5 flex-none text-muted transition-transform group-open:rotate-45"
                          aria-hidden="true"
                        >
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </summary>
                      <p className="pb-5 text-[15.5px] text-muted">{faq.a}</p>
                    </details>
                  ))}
                </div>
              </section>

              <p className="mt-8 text-[13px] text-faint">
                Guidance on this page was last reviewed on{' '}
                {TODAY.format(new Date(content.lastReviewed))}. Rates above are live; the written
                guidance is not, and rules change. Nothing here is financial advice.
              </p>
            </article>

            {/* Other corridors */}
            <aside>
              <h2 className="text-[13px] font-medium text-faint">Other corridors</h2>
              <ul className="mt-3.5 grid gap-2 text-[15px]">
                {CORRIDORS.filter((c) => c.slug !== slug).map((other) => (
                  <li key={other.slug}>
                    <Link
                      href={corridorPath(other.slug)}
                      className="text-ink no-underline hover:text-leaf"
                    >
                      {other.fromCountryName} to Pakistan
                    </Link>
                  </li>
                ))}
              </ul>

              <h2 className="mt-8 text-[13px] font-medium text-faint">Rates</h2>
              <ul className="mt-3.5 grid gap-2 text-[15px]">
                <li>
                  <Link
                    href={`/${corridor.fromCurrency.toLowerCase()}-to-pkr`}
                    className="text-ink no-underline hover:text-leaf"
                  >
                    {corridor.fromCurrency} to PKR rate today
                  </Link>
                </li>
                <li>
                  <Link href="/how-we-rank" className="text-ink no-underline hover:text-leaf">
                    How we rank providers
                  </Link>
                </li>
              </ul>
            </aside>
          </div>
        </div>
      </main>

      <SiteFooter locale={locale} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: content.faqs.map((faq) => ({
                '@type': 'Question',
                name: faq.q,
                acceptedAnswer: { '@type': 'Answer', text: faq.a },
              })),
            },
            {
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'PakRemits', item: SITE },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: `${corridor.fromCountryName} to Pakistan`,
                  item: `${SITE}${path}`,
                },
              ],
            },
          ]),
        }}
      />
    </>
  )
}
