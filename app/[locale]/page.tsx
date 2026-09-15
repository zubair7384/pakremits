import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ComparePanel } from '@/components/compare-panel'
import { RateAlertForm } from '@/components/rate-alert-form'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { Sparkline } from '@/components/sparkline'
import { CORRIDORS, CURRENCY_SYMBOLS, defaultAmountFor } from '@/lib/corridors'
import { formatPkr } from '@/lib/ranking/compute'
import { getBestRatePerCorridor, getComparison, getMidMarketSeries } from '@/lib/quotes'
import type { SendCurrency } from '@/lib/db/schema'
import { notFound } from 'next/navigation'
import { alternatesFor, isLocale } from '@/i18n/routing'
import { corridorPath } from '@/lib/routes'
import { RateMarquee } from '@/components/rate-marquee'
import { CountryFlag } from '@/components/select-icons'
import { CLAIM_FIRST_PAKISTAN_ONLY_SITE } from '@/lib/proof/config'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = isLocale(localeParam) ? localeParam : notFound()
  const t = await getTranslations({ locale, namespace: 'home' })

  return {
    title: `PakRemits — ${t('heroTagline')}`,
    description: t('heroLede'),
    // hreflang for both locales plus x-default, generated from one helper so
    // the URL shape is defined in a single place.
    alternates: alternatesFor('/'),
  }
}

// Quotes change every 15 minutes; the GitHub Actions job pings /api/cron/revalidate
// after each refresh, and this is the backstop if that ping is ever missed.
export const revalidate = 900

/** Currencies shown in the hero ticker, in the design's order. */
const TICKER_CURRENCIES: SendCurrency[] = ['GBP', 'AED', 'SAR', 'USD']

const CURRENCY_NAMES: Record<SendCurrency, string> = {
  GBP: 'British pound',
  AED: 'UAE dirham',
  SAR: 'Saudi riyal',
  USD: 'US dollar',
  CAD: 'Canadian dollar',
  AUD: 'Australian dollar',
  QAR: 'Qatari riyal',
  EUR: 'Euro',
}

const COUNTRY_BY_CURRENCY = new Map(
  CORRIDORS.map((corridor) => [corridor.fromCurrency, corridor.fromCountry]),
)


export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params
  const locale = isLocale(localeParam) ? localeParam : notFound()
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'home' })
  const tProof = await getTranslations({ locale, namespace: 'proof' })

  const faqs = [
    { q: t('faq1Q'), a: t('faq1A') },
    { q: t('faq2Q'), a: t('faq2A') },
    { q: t('faq3Q'), a: t('faq3A') },
    { q: t('faq4Q'), a: t('faq4A') },
    { q: t('faq5Q'), a: t('faq5A') },
    { q: t('faq6Q'), a: t('faq6A') },
  ]

  const [comparison, chips, series] = await Promise.all([
    getComparison({ corridorSlug: 'uk', method: 'bank', amount: 500 }),
    getBestRatePerCorridor(),
    // Every corridor currency, not just the four in the ticker: the marquee
    // carries a trend chip per sending country and reads the same series, so
    // the two never disagree about which way a rate moved.
    Promise.all(CORRIDORS.map((corridor) => getMidMarketSeries(corridor.fromCurrency, 7))),
  ])

  const seriesByCurrency = new Map(series.map((entry) => [entry.currency, entry]))
  const ticker = TICKER_CURRENCIES.map(
    (currency) =>
      seriesByCurrency.get(currency) ?? {
        currency,
        points: [],
        latest: null,
        changePercent: null,
      },
  )

  const marqueeItems = chips.map((chip) => ({
    ...chip,
    changePercent: seriesByCurrency.get(chip.currency)?.changePercent ?? null,
  }))

  const corridorOptions = CORRIDORS.map((corridor) => ({
    slug: corridor.slug,
    countryCode: corridor.fromCountry,
    countryName: corridor.fromCountryName,
    currency: corridor.fromCurrency,
    symbol: CURRENCY_SYMBOLS[corridor.fromCurrency],
    defaultAmount: defaultAmountFor(corridor.fromCurrency),
  }))

  return (
    <>
      <SiteHeader locale={locale} />

      <header className="bg-green px-0 pt-10 pb-32 text-mist">
        <div className="mx-auto grid max-w-[1120px] items-center gap-14 px-6 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            {/* Off by default. See CLAIM_FIRST_PAKISTAN_ONLY_SITE — it must not
                be enabled until someone has actually run the competitor check. */}
            {CLAIM_FIRST_PAKISTAN_ONLY_SITE && (
              <p className="mb-3 text-[13px] tracking-wide text-gold uppercase">
                {tProof('firstPakistanOnlySite')}
              </p>
            )}

            <h1 className="max-w-[13ch] text-[clamp(40px,5.4vw,68px)] leading-[1.02] font-semibold">
              {t('heroTitle')}
            </h1>

            <p className="mt-5 max-w-[46ch] text-lg text-[#C9D9D0]">
              {t('heroLede')}
            </p>

          </div>

          {/* Live ticker */}
          <div
            className="rounded-panel border border-green-3 bg-green-2 px-5.5 pt-2 pb-4"
            aria-label={t('tickerLabel')}
          >
            {ticker.map((series) => {
              // Below 0.05% the label rounds to "0.0%", so showing a green up
              // arrow next to it would claim a movement the number denies.
              const trend =
                series.changePercent === null || Math.abs(series.changePercent) < 0.05
                  ? 'flat'
                  : series.changePercent > 0
                    ? 'up'
                    : 'down'

              return (
                <div
                  key={series.currency}
                  className="grid grid-cols-[1fr_auto] items-center gap-3.5 border-t border-green-3
                             py-3.5 first:border-t-0 sm:grid-cols-[1fr_84px_auto]"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-9 flex-none items-center justify-center rounded-[7px] bg-green-3">
                      <CountryFlag
                        countryCode={COUNTRY_BY_CURRENCY.get(series.currency) ?? 'IE'}
                      />
                    </span>
                    <div>
                      <b className="text-[15px] font-medium text-[#E6EFE9]">
                        {CURRENCY_NAMES[series.currency]}
                      </b>
                      <small className="block text-xs text-[#99B3A6]">
                        {series.currency} → PKR
                      </small>
                    </div>
                  </div>

                  <div className="hidden sm:block">
                    <Sparkline points={series.points} trend={trend} />
                  </div>

                  <div className="text-right tabular-nums">
                    <b className="block font-display text-2xl leading-[1.05] font-semibold text-white">
                      {series.latest?.toFixed(2) ?? '—'}
                    </b>
                    {series.changePercent !== null && (
                      <span
                        className="text-xs"
                        style={{
                          color:
                            trend === 'down'
                              ? 'var(--color-down)'
                              : trend === 'up'
                                ? 'var(--color-up)'
                                : '#99B3A6',
                        }}
                      >
                        {trend === 'flat'
                          ? t('flatThisWeek')
                          : t('changeThisWeek', {
                              direction: trend === 'down' ? '▼' : '▲',
                              percent: Math.abs(series.changePercent).toFixed(1),
                            })}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}

            <div className="mt-2.5 flex flex-col justify-between gap-1 border-t border-green-3 pt-3 text-xs text-[#99B3A6] sm:flex-row">
              <span>{t('tickerFootnote')}</span>
              <span>
                {new Intl.DateTimeFormat('en-GB', {
                  timeZone: 'Asia/Karachi',
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                }).format(new Date())}{' '}
                PKT
              </span>
            </div>
          </div>
        </div>

        {/* Titles the comparison panel below. It lives in the hero rather than
            in <main> because the panel lifts itself 88px over the hero's bottom
            padding (-mt-22), so a heading in <main> would be covered by it.
            Sitting here, the padding is what sets the gap between the two, and
            the title can wrap on a phone without disturbing that overlap.
            Follows the active locale, like the rest of the hero copy. */}
        <h2
          className={`${locale === 'ur' ? 'urdu ' : ''}mx-auto mt-12 max-w-[1120px] px-6
                      text-2xl leading-[1.9] text-gold`}
          lang={locale === 'ur' ? 'ur' : undefined}
        >
          {t('heroTagline')}
        </h2>
      </header>

      <main className="mx-auto max-w-[1120px] px-6">
        {comparison ? (
          <ComparePanel initial={comparison} corridors={corridorOptions} />
        ) : (
          <section className="relative -mt-22 rounded-panel-lg border border-line bg-white p-10">
            <h2 className="font-display text-xl font-semibold">No quotes yet</h2>
            <p className="mt-2 text-muted">
              Run <code>npm run seed</code> then <code>npm run refresh</code> to populate rates.
            </p>
          </section>
        )}

        {/* Corridor marquee — full-bleed, so it sits outside the column above. */}
        <RateMarquee locale={locale} items={marqueeItems} />

        {/* Rate alerts */}
        <section
          id="alerts"
          className="mt-24 grid items-center gap-14 overflow-hidden rounded-[24px] bg-green p-8
                     text-mist sm:p-14 lg:grid-cols-[1.1fr_1fr]"
        >
          <div>
            <h2 className="text-[clamp(30px,4vw,38px)] leading-[1.08] font-semibold">
              {t.rich('alertsTitle', {
                // `rate` is the tag, `rateValue` the value it wraps. Urdu puts
                // the figure mid-sentence rather than at the end, which is the
                // whole reason this is a placeholder and not a concatenation.
                rate: (chunks) => <span className="tabular-nums text-gold">{chunks}</span>,
                rateValue: ticker[0]?.latest
                  ? formatPkr(Math.ceil(ticker[0].latest / 5) * 5)
                  : '₨ 380',
              })}
            </h2>
            <p className="mt-3.5 max-w-[40ch] text-[17px] text-[#C9D9D0]">
              {t('alertsBody')}
            </p>

            {/* Sample alert. Hidden on phones: it is an illustration of what
                arrives, and on a narrow screen it only pushes the form itself
                further down. */}
            <div
              className="relative mt-7 hidden max-w-[380px] rounded-[14px_14px_14px_4px]
                         bg-[#DCF8C6] p-4 text-[14.5px] leading-relaxed text-[#1E2B22] sm:block"
            >
              <div className="mb-1 text-xs font-medium text-[#436B50]">PakRemits alerts</div>
              <b className="font-medium">
                GBP → PKR just crossed{' '}
                {ticker[0]?.latest ? (Math.ceil(ticker[0].latest / 5) * 5).toFixed(0) : '380'}.
              </b>{' '}
              Best right now:{' '}
              {chips.find((chip) => chip.currency === 'GBP')?.bestRate?.toFixed(2) ?? '—'} — open
              PakRemits to see who is paying it.
            </div>
          </div>

          {/* Seeded with the next round number above the current rate, which is
              what someone setting a target actually wants as a starting point. */}
          <RateAlertForm
            defaultRate={
              ticker[0]?.latest ? Math.ceil(ticker[0].latest / 5) * 5 : undefined
            }
          />
        </section>

        <section className="mt-16" aria-labelledby="trust-cards-title">
          <div className="max-w-[54ch]">
            <h2
              id="trust-cards-title"
              className="text-[clamp(28px,3.5vw,34px)] leading-[1.1] font-semibold"
            >
              {t('trustTitle')}
            </h2>
            <p className="mt-3 text-[16px] text-muted">{t('trustLede')}</p>
          </div>

          <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                value: t('trustRouteValue'),
                title: t('trustRouteTitle'),
                body: t('trustRouteBody'),
                path: 'M7 12.5 10.2 16 17.5 8.5M4 5h16v14H4z',
              },
              {
                value: t('trustRefreshValue'),
                title: t('trustRefreshTitle'),
                body: t('trustRefreshBody'),
                path: 'M12 7v5l3 2M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5',
              },
              {
                value: t('trustRankingValue'),
                title: t('trustRankingTitle'),
                body: t('trustRankingBody'),
                path: 'M5 18V9m7 9V5m7 13v-6M3 21h18',
              },
              {
                value: t('trustPayoutValue'),
                title: t('trustPayoutTitle'),
                body: t('trustPayoutBody'),
                path: 'M3 9h18L12 4 3 9Zm2 2v6m4-6v6m6-6v6m4-6v6M3 20h18',
              },
            ].map((card) => (
              <li
                key={card.title}
                className="flex min-h-60 flex-col rounded-panel border border-line bg-white p-6"
              >
                <div className="grid h-10 w-10 place-items-center rounded-[11px] bg-[#E4F3EB] text-leaf">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path d={card.path} />
                  </svg>
                </div>
                <div className="mt-5 min-h-9 font-display text-[25px] leading-tight font-semibold tracking-[-0.02em] text-green">
                  {card.value}
                </div>
                <h3 className="mt-2 text-[15px] font-semibold text-ink">{card.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{card.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Corridors */}
        <section id="corridors" className="mt-24">
          <div className="max-w-[44ch]">
            <h2 className="text-[clamp(30px,4vw,36px)] leading-[1.1] font-semibold">
              {t('corridorsTitle')}
            </h2>
            <p className="mt-3 text-[17px] text-muted">
              {t('corridorsLede')}
            </p>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {chips.map((chip) => (
              <Link
                key={chip.slug}
                href={corridorPath(chip.slug, locale)}
                className="flex flex-col gap-3.5 rounded-[14px] border border-line bg-white p-4.5
                           no-underline transition-all hover:-translate-y-px hover:border-leaf"
              >
                <span className="flex items-center gap-3 text-[15px] font-medium">
                  <span className="grid h-8 w-9 place-items-center" aria-hidden="true">
                    <CountryFlag
                      countryCode={COUNTRY_BY_CURRENCY.get(chip.currency as SendCurrency) ?? 'EU'}
                    />
                  </span>
                  {chip.countryName}
                </span>
                <span className="flex items-baseline justify-between border-t border-line-2 pt-3 text-[12.5px] text-muted">
                  {t('bestToday')}
                  <b className="font-display text-lg font-semibold tabular-nums text-ink">
                    {chip.bestRate?.toFixed(2) ?? '—'}
                  </b>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Why our ranking is different */}
        <section id="how" className="mt-24">
          <div className="max-w-[44ch]">
            <h2 className="text-[clamp(30px,4vw,36px)] leading-[1.1] font-semibold">
              {t('whyTitle')}
            </h2>
          </div>

          <div className="mt-9 grid gap-5 lg:grid-cols-3">
            {[
              {
                title: t('cardRankedTitle'),
                body: t('cardRankedBody'),
                path: 'M4 19h16M6 15V9m4 6V5m4 10v-4m4 4V7',
              },
              {
                title: t('cardPakistanTitle'),
                body: t('cardPakistanBody'),
                path: 'M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18M3 12a9 9 0 0018 0 9 9 0 00-18 0z',
              },
              {
                title: t('cardBonusTitle'),
                body: t('cardBonusBody'),
                path: 'M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z',
              },
            ].map((card) => (
              <div key={card.title} className="rounded-panel border border-line bg-white p-7">
                <div className="mb-4.5 grid h-11 w-11 place-items-center rounded-[12px] bg-[#E4F3EB] text-leaf">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5.5 w-5.5"
                    aria-hidden="true"
                  >
                    <path d={card.path} />
                  </svg>
                </div>
                <h3 className="mb-2 text-[19px] font-semibold">{card.title}</h3>
                <p className="text-[15px] text-muted">{card.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mt-24">
          <div className="max-w-[44ch]">
            <h2 className="text-[clamp(30px,4vw,36px)] leading-[1.1] font-semibold">
              {t('faqTitle')}
            </h2>
          </div>

          <div className="mt-7 border-t border-line">
            {faqs.map((faq, index) => (
              <details key={faq.q} open={index === 0} className="group border-b border-line">
                <summary
                  className="flex cursor-pointer list-none items-center justify-between gap-4 py-5
                             text-[17px] font-medium faq-summary"
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
                <p className="max-w-[70ch] pb-5 text-[15.5px] text-muted">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} />

      {/* FAQPage schema so the questions can win a rich result. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map((faq) => ({
              '@type': 'Question',
              name: faq.q,
              acceptedAnswer: { '@type': 'Answer', text: faq.a },
            })),
          }),
        }}
      />
    </>
  )
}
