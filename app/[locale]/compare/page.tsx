/**
 * Search results, e.g. /compare?from=uk&to=bank&amount=500.
 *
 * Where the hero search form lands. The query string holds the selection, so a
 * results page can be shared or reloaded; it is not indexed, because every
 * combination would otherwise be a thin duplicate of a corridor page.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { CompareResults } from '@/components/compare-results'
import { CompareSearch } from '@/components/compare-search'
import { CountryFlag, PayoutMethodIcon } from '@/components/select-icons'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { Sparkline } from '@/components/sparkline'
import { isLocale, localePath } from '@/i18n/routing'
import { CORRIDORS, corridorBySlug, defaultAmountFor } from '@/lib/corridors'
import { PAYOUT_METHOD, isPayoutOption } from '@/lib/payout'
import { getComparison, getMidMarketSeries } from '@/lib/quotes'
import { staticPath } from '@/lib/routes'
import { publicPageMetadata } from '@/lib/seo'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  return {
    ...publicPageMetadata({
      title: 'Compare money transfers to Pakistan | PakRemits',
      description:
        'Every major service sending to Pakistan, ranked by the exact rupees that land in the account.',
      path: '/compare',
    }),
    robots: { index: false, follow: true },
  }
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: SearchParams
}) {
  const { locale: localeParam } = await params
  const locale = isLocale(localeParam) ? localeParam : notFound()
  setRequestLocale(locale)

  const query = await searchParams
  const corridor = corridorBySlug(single(query.from) ?? '') ?? CORRIDORS[0]
  const toParam = single(query.to)
  const payout = isPayoutOption(toParam) ? toParam : 'bank'
  const parsedAmount = Number.parseFloat(single(query.amount) ?? '')
  // Same cap as /api/quotes.
  const amount =
    Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= 1_000_000
      ? parsedAmount
      : defaultAmountFor(corridor.fromCurrency)

  const [t, tc, tm, tn] = await Promise.all([
    getTranslations({ locale, namespace: 'panel' }),
    getTranslations({ locale, namespace: 'compare' }),
    getTranslations({ locale, namespace: 'methods' }),
    getTranslations({ locale, namespace: 'nav' }),
  ])

  const [comparison, series] = await Promise.all([
    getComparison({ corridorSlug: corridor.slug, method: PAYOUT_METHOD[payout], amount }),
    getMidMarketSeries(corridor.fromCurrency, 7),
  ])

  const payoutLabels = {
    bank: tm('bank'),
    jazzcash: 'JazzCash',
    easypaisa: 'Easypaisa',
    sadapay: 'SadaPay',
    nayapay: 'NayaPay',
    cash: tm('cash'),
    rda: tm('rda'),
  } as const

  const title =
    payout === 'bank'
      ? tc('titleBank')
      : payout === 'cash'
        ? tc('titleCash')
        : tc('titleNamed', { name: payoutLabels[payout] })

  const corridorOptions = CORRIDORS.map((c) => ({
    slug: c.slug,
    countryCode: c.fromCountry,
    countryName: c.fromCountryName,
    currency: c.fromCurrency,
    defaultAmount: defaultAmountFor(c.fromCurrency),
  }))

  const trend =
    series.changePercent === null || Math.abs(series.changePercent) < 0.05
      ? 'flat'
      : series.changePercent > 0
        ? 'up'
        : 'down'

  const refreshed = comparison?.capturedAt
    ? new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Karachi',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(comparison.capturedAt))
    : null

  return (
    <>
      <SiteHeader locale={locale} active="compare" />

      <div className="py-8">
        <div className="mx-auto max-w-[1120px] px-6">
          {/* Keyed on the selection so a new search re-seeds the form. */}
          <CompareSearch
            key={`${corridor.slug}-${payout}-${amount}`}
            corridors={corridorOptions}
            initialCorridor={corridor.slug}
            initialPayout={payout}
            initialAmount={amount}
            layout="row"
          />
        </div>
      </div>

      <main className="mx-auto max-w-[1120px] px-6 pt-12">
        {/* Title and details on the left, rate and alert cards on the right —
            one row on desktop, stacked below lg. */}
        <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="min-w-0">
        <h1 className="flex items-center gap-3 text-[clamp(28px,3.2vw,34px)] leading-tight font-bold">
          <span className="text-green [&_svg]:h-7 [&_svg]:w-7 [&_svg]:text-green">
            <PayoutMethodIcon method={payout} />
          </span>
          {title}
        </h1>

        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[15px] text-muted">
          <span>{tc('providers', { count: comparison?.rows.length ?? 0 })}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5 [&_svg]:h-3.5 [&_svg]:w-5">
            <CountryFlag countryCode={corridor.fromCountry} />
            {corridor.fromCountryName}
          </span>
          <span aria-hidden="true" className="rtl:rotate-180">→</span>
          <span>{tc('pakistan')}</span>
          <span aria-hidden="true">·</span>
          <Link
            href={staticPath('how-we-rank', locale)}
            className="font-medium text-ink underline underline-offset-4"
          >
            {tn('howWeRank')}
          </Link>
        </p>
        {refreshed && (
          <p className="mt-1 text-[13.5px] text-muted">{tc('quotesRefreshed', { time: refreshed })}</p>
        )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-5 rounded-[14px] border border-line bg-white px-5 py-4">
            <div>
              <div className="text-[13px] text-muted">{tc('midMarket')}</div>
              <div className="mt-0.5 font-display text-[19px] font-semibold whitespace-nowrap tabular-nums">
                {series.latest !== null
                  ? `1 ${corridor.fromCurrency} = ${series.latest.toFixed(4)} PKR`
                  : '—'}
              </div>
              {series.changePercent !== null && (
                <div className="mt-0.5 text-[13px] text-muted">
                  {trend === 'flat' ? (
                    tc('flatThisWeek')
                  ) : (
                    <>
                      <span className={trend === 'down' ? 'text-[#C0392B]' : 'text-leaf'}>
                        {trend === 'down' ? '▼' : '▲'} {Math.abs(series.changePercent).toFixed(1)}%
                      </span>{' '}
                      {tc('thisWeek')}
                    </>
                  )}
                </div>
              )}
            </div>
            <Sparkline
              points={series.points}
              width={110}
              height={44}
              trend={trend}
              className={trend === 'down' ? '[&_polyline]:stroke-[#C0392B]' : '[&_polyline]:stroke-leaf'}
            />
          </div>

          <Link
            href={`${localePath(locale, '/')}#alerts`}
            className="flex min-w-[120px] flex-col items-center justify-center gap-1.5 rounded-[14px]
                       border border-line bg-white px-5 py-4 text-[15px] font-medium text-ink
                       no-underline transition-[border-color,box-shadow] hover:border-[#85A61C] hover:shadow-[0_0_0_2px_#85A61C]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
              <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" />
            </svg>
            {tc('getAlerts')}
          </Link>
        </div>
        </div>

        {comparison ? (
          <CompareResults
            // A new search remounts the list so it starts from the new props.
            key={`${corridor.slug}-${payout}-${amount}`}
            initial={comparison} payout={payout} payoutLabel={payoutLabels[payout]} />
        ) : (
          <p className="mt-12 rounded-[14px] border border-line bg-white p-8 text-muted">
            {t('noQuotesYet')}
          </p>
        )}
      </main>

      <SiteFooter locale={locale} />
    </>
  )
}
