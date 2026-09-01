import type { Metadata } from 'next'
import Link from 'next/link'
import { ComparePanel } from '@/components/compare-panel'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { Sparkline } from '@/components/sparkline'
import { CORRIDORS, CURRENCY_SYMBOLS } from '@/lib/corridors'
import { formatPkr } from '@/lib/ranking/compute'
import { getBestRatePerCorridor, getComparison, getMidMarketSeries } from '@/lib/quotes'
import type { SendCurrency } from '@/lib/db/schema'

export const metadata: Metadata = {
  title: 'Bhejo — compare rates before you send money to Pakistan',
  description:
    'Compare every major service sending money to Pakistan, ranked by the exact amount that ' +
    'lands in the account. Live rates for the UK, UAE, Saudi Arabia, USA and more.',
  alternates: { canonical: '/', languages: { 'en-GB': '/', ur: '/ur' } },
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

const FAQS = [
  {
    q: 'Is the rate shown the rate I will actually get?',
    a: 'It is the provider’s live quote at the time shown on the page, refreshed every 15 minutes. The provider confirms the final rate on their site before you pay, and it can move slightly in between. That is why we show a timestamp on every quote.',
  },
  {
    q: 'How does Bhejo make money?',
    a: 'Some providers pay us a fixed commission when a new customer signs up through our link. It does not change your rate and it never changes the order of results, which is always by amount received.',
  },
  {
    q: 'Can I send directly to JazzCash or Easypaisa?',
    a: 'Yes. Choose “JazzCash or Easypaisa” under “Recipient gets it in” and we only show services that pay out to mobile wallets, with the wallet-specific rate and delivery time.',
  },
  {
    q: 'What is the State Bank remittance incentive?',
    a: 'Pakistan’s central bank subsidises transfers through approved channels, which is why licensed services often show zero fees and slightly better rates than the mid-market. We mark providers where the scheme applies.',
  },
]

export default async function HomePage() {
  const [comparison, chips, ticker] = await Promise.all([
    getComparison({ corridorSlug: 'uk', method: 'bank', amount: 500 }),
    getBestRatePerCorridor(),
    Promise.all(TICKER_CURRENCIES.map((currency) => getMidMarketSeries(currency, 7))),
  ])

  const corridorOptions = CORRIDORS.map((corridor) => ({
    slug: corridor.slug,
    countryName: corridor.fromCountryName,
    currency: corridor.fromCurrency,
    symbol: CURRENCY_SYMBOLS[corridor.fromCurrency],
  }))

  // Everything below is derived from live data. The copy rules forbid a
  // hard-coded saving figure, so each of these is null-guarded rather than
  // filled with a placeholder when the database is empty.
  const providerCount = comparison?.rows.filter((r) => !r.quote.isBenchmark).length ?? 0
  const saving = comparison?.savingVsBank ?? null
  const annualSaving = saving !== null ? Math.round((saving * 12) / 1000) * 1000 : null
  const capturedMinutesAgo = comparison?.capturedAt
    ? Math.round((Date.now() - new Date(comparison.capturedAt).getTime()) / 60000)
    : null

  return (
    <>
      <SiteHeader />

      <header className="bg-green px-0 pt-10 pb-32 text-mist">
        <div className="mx-auto grid max-w-[1120px] items-center gap-14 px-6 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <span
              className="inline-flex items-center gap-2 rounded-full border border-green-3
                         py-1.5 pr-3 pl-2.5 text-[13px] text-[#A9BFB4]"
            >
              <i
                className="inline-block h-2 w-2 rounded-full bg-up shadow-[0_0_0_3px_rgba(143,224,179,.25)]"
                aria-hidden="true"
              />
              {providerCount > 0 && capturedMinutesAgo !== null
                ? `Live · ${providerCount} provider${providerCount === 1 ? '' : 's'} checked ${
                    capturedMinutesAgo < 1 ? 'just now' : `${capturedMinutesAgo} minutes ago`
                  }`
                : 'Live rates'}
            </span>

            <h1 className="mt-5.5 max-w-[13ch] text-[clamp(40px,5.4vw,68px)] leading-[1.02] font-semibold">
              Send more rupees home. Same money.
            </h1>

            <p className="mt-5 max-w-[46ch] text-lg text-[#C9D9D0]">
              Compare every major service sending to Pakistan, ranked by the exact amount that lands
              in the account. Not by rate, not by fee, not by who pays us.
            </p>

            {/* TODO: native review — "check the rate before you send money" */}
            <span className="urdu mt-6.5 inline-block text-2xl leading-[1.9] text-gold" lang="ur">
              پیسے بھیجنے سے پہلے ریٹ چیک کریں
            </span>

            <div className="mt-8.5 grid grid-cols-2 gap-7 border-t border-green-3 pt-6 sm:grid-cols-3">
              <div className="text-[13px] text-[#A9BFB4]">
                <strong className="block font-display text-[22px] font-semibold tracking-[-0.02em] text-white">
                  {saving !== null ? formatPkr(saving) : '—'}
                </strong>
                typical saving on {comparison?.currencySymbol ?? '£'}
                {comparison?.amount ?? 500} vs a bank
              </div>
              <div className="text-[13px] text-[#A9BFB4]">
                <strong className="block font-display text-[22px] font-semibold tracking-[-0.02em] text-white">
                  15 min
                </strong>
                rate refresh
              </div>
              <div className="text-[13px] text-[#A9BFB4]">
                <strong className="block font-display text-[22px] font-semibold tracking-[-0.02em] text-white">
                  {CORRIDORS.length}
                </strong>
                sending countries
              </div>
            </div>
          </div>

          {/* Live ticker */}
          <div
            className="rounded-panel border border-green-3 bg-green-2 px-5.5 pt-2 pb-4"
            aria-label="Live mid-market rates to Pakistani rupee"
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
                    <span
                      className="grid h-7 w-7 place-items-center rounded-full bg-green-3 text-[11px]
                                 font-medium text-white"
                      aria-hidden="true"
                    >
                      {series.currency}
                    </span>
                    <div>
                      <b className="text-[15px] font-medium text-[#E6EFE9]">
                        {CURRENCY_NAMES[series.currency]}
                      </b>
                      <small className="block text-xs text-[#7FA090]">
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
                                : '#7FA090',
                        }}
                      >
                        {trend === 'flat'
                          ? 'Flat this week'
                          : `${trend === 'down' ? '▼' : '▲'} ${Math.abs(
                              series.changePercent,
                            ).toFixed(1)}% this week`}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}

            <div className="mt-2.5 flex flex-col justify-between gap-1 border-t border-green-3 pt-3 text-xs text-[#7FA090] sm:flex-row">
              <span>Mid-market reference, 7-day trend</span>
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

        {/* What you lose */}
        <div className="mt-7 grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div className="rounded-panel border border-line bg-white p-7">
            <div className="font-display text-[40px] leading-none font-semibold tracking-[-0.025em] text-green">
              {annualSaving !== null ? `${formatPkr(annualSaving)} a year` : '—'}
            </div>
            <p className="mt-2.5 max-w-[40ch] text-[14.5px] text-muted">
              What a family sending {comparison?.currencySymbol ?? '£'}
              {comparison?.amount ?? 500} a month through a high-street bank loses compared with the
              best-rate service.
            </p>
          </div>

          <div className="rounded-panel border border-line bg-white p-7">
            <div className="font-display text-[40px] leading-none font-semibold tracking-[-0.025em] text-green">
              {providerCount}
            </div>
            <p className="mt-2.5 text-[14.5px] text-muted">
              Services compared on this corridor. We add providers only where we can get a live
              quote without working around their site.
            </p>
          </div>

          <div className="rounded-panel border border-line bg-white p-7">
            <div className="font-display text-[40px] leading-none font-semibold tracking-[-0.025em] text-green">
              0
            </div>
            <p className="mt-2.5 text-[14.5px] text-muted">
              Sponsored positions. Providers pay us the same whether they rank first or last, and we
              say so on every page.
            </p>
          </div>
        </div>

        {/* Rate alerts */}
        <section
          id="alerts"
          className="mt-24 grid items-center gap-14 overflow-hidden rounded-[24px] bg-green p-8
                     text-mist sm:p-14 lg:grid-cols-[1.1fr_1fr]"
        >
          <div>
            <h2 className="text-[clamp(30px,4vw,38px)] leading-[1.08] font-semibold">
              Tell me when the pound hits{' '}
              <span className="tabular-nums text-gold">
                {ticker[0]?.latest ? formatPkr(Math.ceil(ticker[0].latest / 5) * 5) : '₨ 380'}
              </span>
            </h2>
            <p className="mt-3.5 max-w-[40ch] text-[17px] text-[#C9D9D0]">
              Pick a target rate. We watch the market every 15 minutes and message you the moment it
              crosses, with the best provider at that moment.
            </p>

            <div className="relative mt-7 max-w-[380px] rounded-[14px_14px_14px_4px] bg-[#DCF8C6] p-4 text-[14.5px] leading-relaxed text-[#1E2B22]">
              <div className="mb-1 text-xs font-medium text-[#4E7A5B]">Bhejo alerts</div>
              <b className="font-medium">GBP → PKR just crossed 380.</b> Best right now: the highest
              rate we have seen this month. Open Bhejo to see who is paying it.
            </div>
          </div>

          {/* The form itself lands in Phase 3, along with double opt-in and
              the Twilio/Resend notifier. */}
          <div className="rounded-panel border border-green-3 bg-green-2 p-6">
            <p className="text-[15px] text-[#C9D9D0]">
              Rate alerts open shortly. They will send one message per alert, at most once every 12
              hours, with one-tap unsubscribe.
            </p>
            <Link
              href="/#compare"
              className="mt-4.5 flex h-[54px] w-full items-center justify-center rounded-[12px]
                         bg-gold px-6 font-medium text-[#4A3608] no-underline hover:bg-[#D9A43E]"
            >
              Compare rates now
            </Link>
          </div>
        </section>

        {/* Corridors */}
        <section id="corridors" className="mt-24">
          <div className="max-w-[44ch]">
            <h2 className="text-[clamp(30px,4vw,36px)] leading-[1.1] font-semibold">
              Where are you sending from?
            </h2>
            <p className="mt-3 text-[17px] text-muted">
              Every corridor has its own page with live rates, delivery times, and limits.
            </p>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {chips.map((chip) => (
              <Link
                key={chip.slug}
                href={`/send-money-from-${chip.slug}-to-pakistan`}
                className="flex flex-col gap-3.5 rounded-[14px] border border-line bg-white p-4.5
                           no-underline transition-all hover:-translate-y-px hover:border-leaf"
              >
                <span className="flex items-center gap-3 text-[15px] font-medium">
                  <span
                    className="grid h-8 w-8 place-items-center rounded-full bg-line-2 text-xs
                               font-medium text-muted"
                    aria-hidden="true"
                  >
                    {chip.currency.slice(0, 2)}
                  </span>
                  {chip.countryName}
                </span>
                <span className="flex items-baseline justify-between border-t border-line-2 pt-3 text-[12.5px] text-muted">
                  Best today
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
              Why our ranking looks different from other comparison sites
            </h2>
          </div>

          <div className="mt-9 grid gap-5 lg:grid-cols-3">
            {[
              {
                title: 'Ranked by rupees received',
                body: 'We compute the exact amount landing in the account after fees and the real exchange rate, then sort by that. Nothing else moves a provider up.',
                path: 'M4 19h16M6 15V9m4 6V5m4 10v-4m4 4V7',
              },
              {
                title: 'Built for Pakistan only',
                body: 'JazzCash, Easypaisa, Sadapay, Nayapay, Roshan Digital Accounts and cash pickup are all covered. Global comparison sites skip most of them.',
                path: 'M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18M3 12a9 9 0 0018 0 9 9 0 00-18 0z',
              },
              {
                title: 'Bonuses and incentives shown',
                body: 'We flag first-transfer promos and the State Bank’s remittance incentive where they apply, so the number you see is the number that arrives.',
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
              Common questions
            </h2>
          </div>

          <div className="mt-7 border-t border-line">
            {FAQS.map((faq, index) => (
              <details key={faq.q} open={index === 0} className="group border-b border-line">
                <summary
                  className="flex cursor-pointer list-none items-center justify-between gap-4 py-5
                             text-[17px] font-medium [&::-webkit-details-marker]:hidden"
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

      <SiteFooter />

      {/* FAQPage schema so the questions can win a rich result. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQS.map((faq) => ({
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
