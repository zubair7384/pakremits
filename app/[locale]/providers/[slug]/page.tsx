/**
 * Provider pages.
 *
 * The live rate across every corridor is the substance here — it is the one
 * thing a provider's own marketing page will never show you, and the reason
 * someone would read this rather than the provider's site.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { setRequestLocale } from 'next-intl/server'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { toLocale } from '@/i18n/routing'
import { CORRIDORS, CURRENCY_SYMBOLS, formatSend } from '@/lib/corridors'
import { db } from '@/lib/db'
import { providers } from '@/lib/db/schema'
import { formatPkr } from '@/lib/ranking/compute'
import { getComparison } from '@/lib/quotes'
import { corridorPath } from '@/lib/routes'

export const revalidate = 900

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

const RAILS = [
  { key: 'supportsBank', label: 'Bank account deposit' },
  { key: 'supportsWallet', label: 'JazzCash and Easypaisa' },
  { key: 'supportsNeobank', label: 'Sadapay and Nayapay' },
  { key: 'supportsCash', label: 'Cash pickup' },
  { key: 'supportsRda', label: 'Roshan Digital Account' },
] as const

/**
 * Deliberately unguarded, unlike the read helpers in lib/quotes.ts.
 *
 * This page is entirely about one provider — with no row there is nothing to
 * degrade to. Swallowing a database error here would turn an outage into
 * `notFound()`, and a 404 tells a crawler the page is *gone*, which invites
 * de-indexing a page that was fine ten minutes ago. Letting it throw yields a
 * 5xx, which means "try again" — the honest answer during an outage.
 *
 * The home and corridor pages degrade instead, because they have surrounding
 * content worth serving.
 */
async function getProvider(slug: string) {
  const [row] = await db.select().from(providers).where(eq(providers.slug, slug)).limit(1)
  return row ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale: localeParam, slug } = await params
  const locale = toLocale(localeParam)
  const provider = await getProvider(slug).catch(() => null)
  if (!provider) return {}

  return {
    title: `${provider.name} review — rates to Pakistan | PakRemits`,
    description:
      `${provider.name}'s live exchange rate and fees for sending money to Pakistan, across ` +
      'every corridor we track, compared against the mid-market rate.',
    alternates: { canonical: `/providers/${slug}` },
  }
}

export default async function ProviderPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: localeParam, slug } = await params
  const locale = toLocale(localeParam)
  setRequestLocale(locale)
  const provider = await getProvider(slug)
  if (!provider || !provider.active || provider.isBenchmark) notFound()

  // Live rate for this provider in every corridor it serves.
  const perCorridor = await Promise.all(
    CORRIDORS.map(async (corridor) => {
      const comparison = await getComparison({
        corridorSlug: corridor.slug,
        method: 'bank',
        includeBenchmark: false,
      })
      const row = comparison?.rows.find((r) => r.quote.providerSlug === slug)
      const best = comparison?.rows.find((r) => r.isBest)

      return {
        corridor,
        row,
        isBest: row && best ? row.quote.providerSlug === best.quote.providerSlug : false,
        gapToBest: row && best ? row.quote.amountReceived - best.quote.amountReceived : null,
        amount: comparison?.amount ?? null,
      }
    }),
  )

  const served = perCorridor.filter((entry) => entry.row)
  const winning = served.filter((entry) => entry.isBest).length

  return (
    <>
      <SiteHeader locale={locale} />

      <main className="mx-auto max-w-[1120px] px-6 py-14">
        <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="no-underline hover:text-leaf">
                PakRemits
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/providers" className="no-underline hover:text-leaf">
                Providers
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-ink">{provider.name}</li>
          </ol>
        </nav>

        <div className="mt-6 flex flex-wrap items-center gap-5">
          <span
            className="grid h-16 w-16 place-items-center rounded-[14px] font-display text-2xl font-bold"
            style={{ background: provider.brandColor, color: provider.brandTextColor }}
            aria-hidden="true"
          >
            {provider.name.charAt(0)}
          </span>
          <h1 className="text-[clamp(30px,4vw,44px)] leading-tight font-semibold">
            {provider.name} for sending to Pakistan
          </h1>
        </div>

        <p className="mt-5 max-w-[62ch] text-[17px] text-muted">
          {served.length === 0 ? (
            <>
              We do not currently have live quotes for {provider.name} in any corridor. That
              usually means the provider does not serve these routes, or we cannot obtain a quote
              without working around their site.
            </>
          ) : (
            <>
              We have live quotes for {provider.name} in {served.length} of our{' '}
              {CORRIDORS.length} corridors.{' '}
              {winning > 0
                ? `Right now it pays the most rupees in ${winning} of them.`
                : 'Right now another service pays more in every one of them.'}{' '}
              Rates below are refreshed every 15 minutes.
            </>
          )}
        </p>

        {/* Live rate across corridors */}
        <section className="mt-10">
          <h2 className="text-[26px] leading-tight font-semibold">Live rates by corridor</h2>

          <div className="mt-4 overflow-x-auto rounded-panel border border-line bg-white">
            <table className="w-full min-w-[720px] border-collapse text-[15px]">
              <thead>
                <tr className="border-b border-line text-left text-xs text-faint">
                  <th className="p-4 font-medium">Corridor</th>
                  <th className="p-4 text-right font-medium">Rate</th>
                  <th className="p-4 text-right font-medium">Fee</th>
                  <th className="p-4 text-right font-medium">Recipient gets</th>
                  <th className="p-4 text-right font-medium">Against the best</th>
                </tr>
              </thead>
              <tbody>
                {perCorridor.map((entry) => {
                  const symbol = CURRENCY_SYMBOLS[entry.corridor.fromCurrency]

                  return (
                    <tr
                      key={entry.corridor.slug}
                      className="border-b border-line-2 last:border-0"
                    >
                      <td className="p-4">
                        <Link
                          href={corridorPath(entry.corridor.slug)}
                          className="text-ink no-underline hover:text-leaf"
                        >
                          {entry.corridor.fromCountryName}
                        </Link>
                        <span className="ml-2 text-[13px] text-faint">
                          {entry.corridor.fromCurrency}
                        </span>
                      </td>

                      {entry.row ? (
                        <>
                          <td className="p-4 text-right tabular-nums">
                            {entry.row.quote.rate.toFixed(2)}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {formatSend(symbol, entry.row.quote.fee.toFixed(2))}
                          </td>
                          <td className="p-4 text-right font-medium tabular-nums">
                            {formatPkr(entry.row.quote.amountReceived)}
                            {entry.amount !== null && (
                              <small className="block text-xs font-normal text-faint">
                                on {formatSend(symbol, entry.amount)}
                              </small>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {entry.isBest ? (
                              <span className="rounded-full bg-gold px-2.5 py-1 text-[11.5px] font-medium text-[#4A3608]">
                                Best deal
                              </span>
                            ) : (
                              <span className="text-[13.5px] tabular-nums text-muted">
                                {entry.gapToBest !== null
                                  ? `${formatPkr(Math.abs(entry.gapToBest))} behind`
                                  : '—'}
                              </span>
                            )}
                          </td>
                        </>
                      ) : (
                        <td colSpan={4} className="p-4 text-right text-[13.5px] text-faint">
                          Not available in this corridor
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-12 grid gap-10 lg:grid-cols-2">
          <section>
            <h2 className="text-[26px] leading-tight font-semibold">What it supports</h2>
            <ul className="mt-4 grid gap-2.5 text-[16px]">
              {RAILS.map((rail) => {
                const supported = provider[rail.key]
                return (
                  <li key={rail.key} className="flex items-center gap-2.5">
                    <span
                      className={`grid h-5 w-5 flex-none place-items-center rounded-full ${
                        supported ? 'bg-[#E4F3EB] text-leaf' : 'bg-line-2 text-faint'
                      }`}
                      aria-hidden="true"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="h-2.5 w-2.5"
                      >
                        <path d={supported ? 'M4 12l6 6L20 6' : 'M6 6l12 12M18 6L6 18'} />
                      </svg>
                    </span>
                    <span className={supported ? 'text-ink' : 'text-faint line-through'}>
                      {rail.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section>
            <h2 className="text-[26px] leading-tight font-semibold">How we make money from this</h2>
            <p className="mt-4 text-[16px] text-muted">
              {provider.affiliateUrlTemplate
                ? provider.commissionNote ??
                  `We earn a commission when a new customer signs up with ${provider.name} through our link.`
                : `We currently earn nothing from ${provider.name}. Links to them are plain links to their site.`}{' '}
              Either way it has no effect on where they appear in any table —{' '}
              <Link href="/how-we-rank" className="text-leaf underline underline-offset-2">
                the ranking function has no commission input at all
              </Link>
              .
            </p>

            {provider.homepageUrl && (
              <a
                href={`/go/${provider.slug}`}
                rel="sponsored nofollow"
                className="mt-6 inline-flex h-12 items-center rounded-control bg-ink px-6 font-medium text-white no-underline hover:bg-black"
              >
                Visit {provider.name}
              </a>
            )}
          </section>
        </div>
      </main>

      <SiteFooter locale={locale} />

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'PakRemits', item: SITE },
              { '@type': 'ListItem', position: 2, name: 'Providers', item: `${SITE}/providers` },
              {
                '@type': 'ListItem',
                position: 3,
                name: provider.name,
                item: `${SITE}/providers/${provider.slug}`,
              },
            ],
          }),
        }}
      />
    </>
  )
}
