/**
 * Delivery-method pages, reached via rewrites from /send-money-to-[slug] and
 * /roshan-digital-account-transfer.
 *
 * The comparison panel is pre-set to the relevant rail, so a reader who lands
 * here from "send money to jazzcash" sees wallet rates immediately rather than
 * bank rates they would have to switch away from.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ComparePanel } from '@/components/compare-panel'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { alternatesFor, toLocale } from '@/i18n/routing'
import { CORRIDORS, CURRENCY_SYMBOLS, defaultAmountFor } from '@/lib/corridors'
import { METHOD_CONTENT, methodBySlug } from '@/lib/content/methods'
import { methodPath } from '@/lib/routes'
import { getComparison } from '@/lib/quotes'
import { corridorPath } from '@/lib/routes'

export const revalidate = 900

export function generateStaticParams() {
  return METHOD_CONTENT.map((entry) => ({ slug: entry.slug }))
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale: localeParam, slug } = await params
  const locale = toLocale(localeParam)
  const content = methodBySlug(slug)
  if (!content) return {}

  const path = methodPath(slug)
  return {
    title: `${content.title} | PakRemits`,
    description: content.metaDescription,
    alternates: alternatesFor(path),
    openGraph: { url: `${SITE}${path}`, type: 'article' },
  }
}

export default async function MethodPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: localeParam, slug } = await params
  const locale = toLocale(localeParam)
  setRequestLocale(locale)
  const tCommon = await getTranslations({ locale, namespace: 'common' })
  const content = methodBySlug(slug)
  if (!content) notFound()

  // Default to the UK corridor, which has the deepest provider coverage.
  const comparison = await getComparison({ corridorSlug: 'uk', method: content.method })

  const corridorOptions = CORRIDORS.map((c) => ({
    slug: c.slug,
    countryName: c.fromCountryName,
    currency: c.fromCurrency,
    symbol: CURRENCY_SYMBOLS[c.fromCurrency],
    defaultAmount: defaultAmountFor(c.fromCurrency),
  }))

  const hasQuotes = (comparison?.rows.filter((r) => !r.quote.isBenchmark).length ?? 0) > 0

  return (
    <>
      <SiteHeader locale={locale} />

      <main>
        <div className="bg-green px-0 pt-10 pb-28 text-mist">
          <div className="mx-auto max-w-[1120px] px-6">
            <nav aria-label="Breadcrumb" className="text-[13px] text-[#99B3A6]">
              <ol className="flex items-center gap-2">
                <li>
                  <Link href="/" className="no-underline hover:text-white">
                    PakRemits
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li className="text-[#C9D9D0]">{content.title}</li>
              </ol>
            </nav>

            <h1 className="mt-5 max-w-[18ch] text-[clamp(32px,4.4vw,50px)] leading-[1.05] font-semibold">
              {content.title}
            </h1>

            <div className="mt-5 max-w-[58ch] space-y-4 text-[17px] text-[#C9D9D0]">
              {content.intro.map((paragraph) => (
                <p key={paragraph.slice(0, 32)}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1120px] px-6">
          {comparison && hasQuotes ? (
            <ComparePanel initial={comparison} corridors={corridorOptions} />
          ) : (
            <section className="relative -mt-20 rounded-panel-lg border border-line bg-white p-10">
              <h2 className="font-display text-xl font-semibold">
                No live quotes for this method yet
              </h2>
              <p className="mt-2 max-w-[62ch] text-muted">
                None of the services we can quote automatically currently pays out this way on the
                corridors we track. Rather than show you an estimate, we show nothing. The{' '}
                <Link href="/" className="text-leaf underline underline-offset-2">
                  main comparison
                </Link>{' '}
                covers bank deposits, which every provider supports.
              </p>
            </section>
          )}

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
                                   py-5 text-[17px] font-medium [&::-webkit-details-marker]:hidden"
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
                Guidance last reviewed{' '}
                {new Intl.DateTimeFormat('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }).format(new Date(content.lastReviewed))}
                . Rates above are live; this guidance is not, and wallet limits in particular are
                revised periodically.
              </p>
            </article>

            <aside>
              <h2 className="text-[13px] font-medium text-faint">Other ways to receive</h2>
              <ul className="mt-3.5 grid gap-2 text-[15px]">
                {METHOD_CONTENT.filter((entry) => entry.slug !== slug).map((entry) => (
                  <li key={entry.slug}>
                    <Link
                      href={methodPath(entry.slug)}
                      className="text-ink no-underline hover:text-leaf"
                    >
                      {entry.title}
                    </Link>
                  </li>
                ))}
              </ul>

              <h2 className="mt-8 text-[13px] font-medium text-faint">By country</h2>
              <ul className="mt-3.5 grid gap-2 text-[15px]">
                {CORRIDORS.slice(0, 4).map((corridor) => (
                  <li key={corridor.slug}>
                    <Link
                      href={corridorPath(corridor.slug)}
                      className="text-ink no-underline hover:text-leaf"
                    >
                      From {corridor.fromCountryName}
                    </Link>
                  </li>
                ))}
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
                  name: content.title,
                  item: `${SITE}${methodPath(slug)}`,
                },
              ],
            },
          ]),
        }}
      />
    </>
  )
}
