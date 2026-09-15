'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { Comparison } from '@/lib/quotes'
import type { DeliveryMethod } from '@/lib/db/schema'
import type { SortKey } from '@/lib/ranking/rank'
import { formatPkr } from '@/lib/ranking/compute'
import { formatSend } from '@/lib/corridors'
import { staticPath } from '@/lib/routes'
import type { Locale } from '@/i18n/routing'
import { IconSelect, type IconSelectOption } from '@/components/icon-select'
import { CountryFlag, PayoutMethodIcon } from '@/components/select-icons'
import { ProviderLogo } from '@/components/provider-logo'

/**
 * The comparison panel.
 *
 * Server-rendered with real data on first paint, then updates in place from
 * /api/quotes when the user changes anything. All ranking and arithmetic stays
 * on the server — this component only renders what it is given, so there is one
 * implementation of the ranking rules rather than two that can drift.
 */

interface CorridorOption {
  slug: string
  countryCode: string
  countryName: string
  currency: string
  symbol: string
  /** The corridor's standard amount, used when switching into it. */
  defaultAmount: number
}

interface Props {
  initial: Comparison
  corridors: CorridorOption[]
}

const METHOD_KEYS: DeliveryMethod[] = ['bank', 'wallet', 'neobank', 'cash', 'rda']
const SORT_KEYS: SortKey[] = ['received', 'fastest', 'lowest-fee']

/** Sort key → catalogue key. Kept explicit so a new sort cannot silently
 *  fall back to its raw key as a user-visible label. */
const SORT_LABEL_KEY: Record<SortKey, 'sortReceived' | 'sortFastest' | 'sortLowestFee'> = {
  received: 'sortReceived',
  fastest: 'sortFastest',
  'lowest-fee': 'sortLowestFee',
}

/**
 * Provider-supplied strings that reach the page untranslated — the delivery
 * SLA and the promo note — are Latin text. Dropped into right-to-left Urdu the
 * bidi algorithm reorders them: "3–5 days" renders as "days 5–3", which is not
 * a translation gap but plain nonsense. Isolating the run fixes the ordering;
 * the buckets below fix the language.
 */
function Isolated({ children }: { children: React.ReactNode }) {
  return <bdi>{children}</bdi>
}

const PKT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Karachi',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-3 w-3">
      <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
    </svg>
  )
}

export function ComparePanel({ initial, corridors }: Props) {
  const t = useTranslations('panel')
  const tm = useTranslations('methods')
  const locale = useLocale()

  /**
   * Delivery speed, as text.
   *
   * English keeps the provider's own published wording, which is more precise
   * than any bucket we could derive — 4320 minutes is "3–5 days" for Remitly
   * and "2–4 days" for a bank, and minutes alone cannot tell them apart. Other
   * locales get a bucket, because showing the English is worse than showing a
   * slightly coarser translation.
   */
  const speedLabel = (minutes: number | null, fallback: string): string => {
    if (locale === 'en') return fallback
    if (minutes === null) return t('speedVaries')
    if (minutes <= 30) return t('speedMinutes')
    if (minutes <= 360) return t('speedHours')
    if (minutes <= 1440) return t('speedSameDay')
    return t('speedFewDays')
  }

  /** Known promo notes get a translation; anything else is isolated as-is. */
  const promoLabel = (note: string): string =>
    note === 'New-customer rate' ? t('promoNewCustomer') : note
  const [corridor, setCorridor] = useState(initial.corridorSlug)
  const [method, setMethod] = useState<DeliveryMethod>(initial.deliveryMethod)
  const [amountText, setAmountText] = useState(String(initial.amount))
  const [sort, setSort] = useState<SortKey>('received')
  const [data, setData] = useState<Comparison>(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const headingId = useId()
  // Lets a slow response from an earlier keystroke lose to a newer one.
  const requestSeq = useRef(0)

  const symbol = corridors.find((c) => c.slug === corridor)?.symbol ?? initial.currencySymbol

  useEffect(() => {
    const amount = Number.parseFloat(amountText)
    if (!Number.isFinite(amount) || amount <= 0) return

    // Nothing changed from what we were rendered with — skip the initial fetch.
    if (
      corridor === data.corridorSlug &&
      method === data.deliveryMethod &&
      amount === data.amount &&
      sort === 'received' &&
      data === initial
    ) {
      return
    }

    const seq = ++requestSeq.current
    const controller = new AbortController()

    // Debounced so dragging the amount field does not fire a request per digit.
    const timer = setTimeout(async () => {
      setPending(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          corridor,
          method,
          amount: String(amount),
          sort,
        })
        const response = await fetch(`/api/quotes?${params}`, { signal: controller.signal })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = (await response.json()) as Comparison

        // A stale response must never overwrite a newer one.
        if (seq === requestSeq.current) setData(payload)
      } catch (caught) {
        if ((caught as Error).name !== 'AbortError' && seq === requestSeq.current) {
          setError('Could not refresh quotes. Showing the last figures we had.')
        }
      } finally {
        if (seq === requestSeq.current) setPending(false)
      }
    }, 350)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [corridor, method, amountText, sort, data, initial])

  const rows = data.rows
  const realProviderCount = rows.filter((r) => !r.quote.isBenchmark).length
  const capturedLabel = data.capturedAt ? PKT.format(new Date(data.capturedAt)) : null

  const fieldShell =
    'h-[54px] w-full rounded-[12px] border-[1.5px] border-line bg-white ' +
    'transition-colors hover:border-[#B9C7BF]'

  const fieldClass =
    `${fieldShell} px-4 text-base text-ink ` +
    'focus:border-leaf focus:outline-none focus:ring-4 focus:ring-leaf/15'

  const corridorSelectOptions: IconSelectOption[] = corridors.map((option) => ({
    value: option.slug,
    label: `${option.countryName} · ${option.currency}`,
    icon: <CountryFlag countryCode={option.countryCode} />,
  }))

  const methodSelectOptions: IconSelectOption[] = METHOD_KEYS.map((value) => ({
    value,
    label: tm(value),
    icon: <PayoutMethodIcon method={value} />,
  }))

  /**
   * The amount field is a flex row, not an input with a fixed left pad: symbols
   * run from one character to three ("$", "C$", "SAR"), and at any single pad
   * the wider ones either collided with the amount or left a gap. The border and
   * focus ring move to the wrapper so it still reads as one control.
   */
  const amountShell =
    `${fieldShell} flex items-center gap-1.5 px-4 ` +
    'focus-within:border-leaf focus-within:ring-4 focus-within:ring-leaf/15'

  return (
    <section id="compare" className="relative -mt-22">
      <div
        className="overflow-hidden rounded-panel-lg border border-line bg-white
                   shadow-[0_40px_80px_-40px_rgba(11,61,46,.45),0_2px_6px_rgba(11,61,46,.06)]"
      >
        <h2 id={headingId} className="sr-only">
          {t('heading')}
        </h2>

        {/* Controls */}
        <div className="grid items-end gap-3.5 bg-white p-7 sm:grid-cols-2 lg:grid-cols-[1.15fr_1.15fr_1.4fr_auto]">
          <div>
            <label htmlFor="from" className="mb-1.5 block text-[13px] text-muted">
              {t('sendingFrom')}
            </label>
            <IconSelect
                id="from"
                label={t('sendingFrom')}
                value={corridor}
                options={corridorSelectOptions}
                onChange={(next) => {
                  setCorridor(next)
                  // Reset the amount to this corridor's standard figure.
                  // Currencies differ by an order of magnitude — £500 is about
                  // 2,300 AED — so carrying the number across a switch showed
                  // "د.إ 500" to someone who had asked about £500, and quietly
                  // extrapolated it from a band captured at a different amount.
                  const target = corridors.find((c) => c.slug === next)
                  if (target) setAmountText(String(target.defaultAmount))
                }}
                className={fieldClass}
              />
          </div>

          <div>
            <label htmlFor="method" className="mb-1.5 block text-[13px] text-muted">
              {t('recipientGets')}
            </label>
            <IconSelect
                id="method"
                label={t('recipientGets')}
                value={method}
                options={methodSelectOptions}
                onChange={(value) => setMethod(value as DeliveryMethod)}
                className={fieldClass}
              />
          </div>

          <div>
            <label htmlFor="amt" className="mb-1.5 block text-[13px] text-muted">
              {t('youSend')}
            </label>
            <div className={amountShell}>
              <span
                className="shrink-0 font-display text-[22px] font-semibold text-muted"
                aria-hidden="true"
              >
                {symbol}
              </span>
              <input
                id="amt"
                value={amountText}
                onChange={(event) => setAmountText(event.target.value.replace(/[^\d.]/g, ''))}
                inputMode="decimal"
                aria-label={`Amount in ${data.fromCurrency}`}
                className="min-w-0 flex-1 bg-transparent font-display text-2xl font-semibold
                           text-ink focus:outline-none"
              />
            </div>
          </div>

          {/* The panel is live; this is a focus target for keyboard users and a
              no-op affordance for anyone expecting a submit button. */}
          <button
            type="button"
            onClick={() => setAmountText((value) => value)}
            className="flex h-[54px] items-center justify-center gap-2.5 rounded-[12px] bg-leaf
                       px-6 text-base font-medium text-white transition-colors hover:bg-leaf-dark
                       active:scale-[.985]"
          >
            {t('compareButton')}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4.5 w-4.5">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>

        {/* Meta bar */}
        <div
          className="flex flex-col items-start justify-between gap-3 border-y border-line bg-mist
                     px-7 py-3.5 text-[13px] text-muted sm:flex-row sm:items-center"
        >
          <div className="flex flex-wrap items-center gap-4.5">
            <span className="inline-flex items-center gap-1.5">
              <i
                className={`inline-block h-[7px] w-[7px] rounded-full ${
                  data.stale ? 'bg-gold' : 'bg-leaf'
                }`}
                aria-hidden="true"
              />
              {capturedLabel ? t('capturedAt', { time: capturedLabel }) : t('noQuotesYet')}
              {data.stale && (
                <span className="ml-1.5 rounded-full bg-gold-bg px-2 py-0.5 text-[11.5px] text-gold-dark">
                  {t('stale')}
                </span>
              )}
            </span>
            <span className="hidden sm:inline">
              {t('deliversThisWay', { count: realProviderCount })}
            </span>
          </div>

          <div
            // flex-wrap on the group, nowrap inside each pill: Urdu labels are
            // longer than the English, and without this the text wrapped inside
            // the pills and doubled the control's height.
            className="flex flex-wrap gap-1 rounded-full border border-line bg-white p-[3px]"
            role="group"
            aria-label={t('sortBy')}
          >
            {SORT_KEYS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSort(value)}
                aria-pressed={sort === value}
                className={`rounded-full px-3 py-[5px] text-[13px] whitespace-nowrap transition-colors ${
                  sort === value ? 'bg-ink text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {t(SORT_LABEL_KEY[value])}
              </button>
            ))}
          </div>
        </div>

        {/* Column headings, hidden on mobile where the layout reflows */}
        <div
          className="hidden grid-cols-[44px_1.5fr_.8fr_.7fr_1.35fr_166px] gap-4.5 px-7 pt-3 pb-2
                     text-xs text-faint lg:grid"
          aria-hidden="true"
        >
          <span />
          <span>{t('columnProvider')}</span>
          <span className="text-right">{t('columnRate')}</span>
          <span className="text-right">{t('columnFee')}</span>
          <span>{t('columnReceives')}</span>
          <span />
        </div>

        {/* Results */}
        {/* min-height holds the panel steady across a refresh. Without it a
            corridor with no quotes collapsed this area to nothing the moment
            the request went out and snapped back when it landed. */}
        <div
          className={`min-h-[104px] px-7 pb-2 transition-opacity ${
            pending ? 'opacity-60' : 'opacity-100'
          }`}
          aria-live="polite"
          aria-busy={pending}
        >
          {error && (
            <p className="py-4 text-[13px] text-[#A32D2D]" role="status">
              {t('refreshError')}
            </p>
          )}

          {rows.length === 0 && (
            <p className={`py-8 text-center ${data.unavailable ? 'text-[#A32D2D]' : 'text-muted'}`}>
              {data.unavailable
                ? t('unavailable')
                : t('emptyState', { currency: data.fromCurrency })}
            </p>
          )}

          {rows.map((row) => {
            const q = row.quote
            const isBest = row.isBest

            return (
              <div
                key={q.providerSlug}
                className={`grid grid-cols-[44px_1fr] items-center gap-x-4.5 gap-y-3.5 border-t
                            border-line-2 py-4.5 first:border-t-0
                            lg:grid-cols-[44px_1.5fr_.8fr_.7fr_1.35fr_166px] lg:gap-y-0 ${
                              isBest
                                ? '-mx-7 rounded-[14px] border-t-0 bg-gold-bg px-7'
                                : ''
                            }`}
              >
                <ProviderLogo
                  providerSlug={q.providerSlug}
                  providerName={q.providerName}
                  brandColor={q.brandColor}
                  brandTextColor={q.brandTextColor}
                />

                <div>
                  <div className="flex flex-wrap items-center gap-2 text-base font-medium">
                    {q.providerName}
                    {isBest && (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full bg-gold px-2.5
                                   py-[3px] text-[11.5px] font-medium text-[#4A3608]"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-[11px] w-[11px]">
                          <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
                        </svg>
                        {t('bestDeal')}
                      </span>
                    )}
                    {/* Sponsored placement sits below the winner, never above.
                        The label is not optional — see /how-we-rank. */}
                    {q.featured && !isBest && (
                      <span className="rounded-full bg-line-2 px-2.5 py-[3px] text-[11.5px] text-muted">
                        {t('sponsored')}
                      </span>
                    )}
                    {q.promo && q.promoNote && (
                      <span className="rounded-full bg-[#F1EAFB] px-2.5 py-[3px] text-[11.5px] text-[#7A4EB8]">
                        <Isolated>{promoLabel(q.promoNote)}</Isolated>
                      </span>
                    )}
                    {q.stale && (
                      <span className="rounded-full bg-gold-bg px-2.5 py-[3px] text-[11.5px] text-gold-dark">
                        {t('stale')}
                      </span>
                    )}
                  </div>

                  <div className="mt-[3px] flex flex-wrap items-center gap-2 text-[13px] text-muted">
                    {q.isBenchmark ? t('swiftTransfer') : t('bankDeposit')}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${
                        (q.deliverySpeedMinutes ?? Number.POSITIVE_INFINITY) <= 600
                          ? 'bg-[#E4F3EB] text-[#1C6B4A]'
                          : 'bg-line-2 text-muted'
                      }`}
                    >
                      {(q.deliverySpeedMinutes ?? Number.POSITIVE_INFINITY) <= 600 && <BoltIcon />}
                      <Isolated>
                        {speedLabel(q.deliverySpeedMinutes, q.deliverySpeedText)}
                      </Isolated>
                    </span>
                  </div>
                </div>

                <div className="hidden text-right text-[15px] tabular-nums lg:block">
                  {q.rate.toFixed(2)}
                  <small className="block text-xs text-faint">{t('perUnit', { symbol })}</small>
                </div>

                <div className="hidden text-right text-[15px] tabular-nums lg:block">
                  {formatSend(symbol, q.fee.toFixed(2))}
                </div>

                <div className="col-span-2 tabular-nums lg:col-span-1">
                  <b className="block font-display text-[26px] leading-none font-semibold tracking-[-0.02em]">
                    {formatPkr(q.amountReceived)}
                  </b>
                  <div className="my-2.5 h-1 overflow-hidden rounded-sm bg-line-2">
                    <i
                      className="block h-full rounded-sm"
                      style={{
                        width: `${row.barPercent}%`,
                        background: isBest
                          ? 'var(--color-leaf)'
                          : q.isBenchmark
                            ? '#E0B4B4'
                            : '#B9C7BF',
                      }}
                    />
                  </div>
                  <div
                    className={`text-[12.5px] ${
                      isBest
                        ? 'font-medium text-gold-dark'
                        : q.isBenchmark
                          ? 'text-[#A32D2D]'
                          : 'text-muted'
                    }`}
                  >
                    {isBest && data.savingVsBank !== null
                      ? t('moreThanBank', { amount: formatPkr(data.savingVsBank) })
                      : row.diffFromBest === 0
                        ? t('bestAvailable')
                        : t('lessThanBest', { amount: formatPkr(Math.abs(row.diffFromBest)) })}
                  </div>
                </div>

                <div className="col-span-2 lg:col-span-1">
                  {q.isBenchmark ? (
                    <Link
                      // Through staticPath, not hard-coded: an Urdu reader
                      // was being sent to the English page. See lib/routes.ts.
                      href={`${staticPath('how-we-rank', locale as Locale)}#bank-benchmark`}
                      className="flex h-[42px] w-full items-center justify-center gap-2 rounded-control
                                 border-[1.5px] border-line bg-white text-[13.5px] font-medium
                                 whitespace-nowrap text-ink no-underline transition-colors
                                 hover:border-ink hover:bg-ink hover:text-white lg:w-[166px]"
                    >
                      {t('whySoLow')}
                    </Link>
                  ) : (
                    <a
                      href={`/go/${q.providerSlug}?corridor=${data.corridorSlug}&amount=${data.amount}&method=${data.deliveryMethod}`}
                      // Affiliate links must be marked for search engines.
                      rel="sponsored nofollow"
                      className={`flex h-[42px] w-full items-center justify-center gap-2 rounded-control
                                  border-[1.5px] text-[13.5px] font-medium whitespace-nowrap
                                  no-underline transition-colors lg:w-[166px] ${
                                    isBest
                                      ? 'border-ink bg-ink text-white hover:bg-black'
                                      : 'border-line bg-white text-ink hover:border-ink hover:bg-ink hover:text-white'
                                  }`}
                    >
                      {t('sendWith', { provider: q.providerName.split(' ')[0] })}
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        className="h-3.5 w-3.5"
                      >
                        <path d="M7 17L17 7M8 7h9v9" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div
          className="flex flex-col justify-between gap-2 border-t border-line-2 px-7 pt-4 pb-5
                     text-[12.5px] text-faint sm:flex-row sm:gap-6"
        >
          <span>
            {t('disclaimerQuotes')}
            {data.amount !== data.quotedAtAmount &&
              ` ${t('disclaimerCaptured', {
                amount: formatSend(symbol, data.quotedAtAmount),
              })}`}
          </span>
          <span>{t('disclaimerCommission')}</span>
        </div>
      </div>
    </section>
  )
}
