'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { Comparison } from '@/lib/quotes'
import type { SortKey } from '@/lib/ranking/rank'
import { formatPkr } from '@/lib/ranking/compute'
import { formatSend } from '@/lib/corridors'
import { staticPath } from '@/lib/routes'
import type { Locale } from '@/i18n/routing'
import { ProviderLogo } from '@/components/provider-logo'
import type { PayoutOption } from '@/components/select-icons'
import { isNamedBankAccount } from '@/lib/payout'

/**
 * Ranked results on /compare.
 *
 * Server-rendered with the requested selection; the sort pills re-fetch from
 * /api/quotes so all ranking still happens on the server, exactly as in the
 * live ComparePanel.
 */

const SORT_KEYS: SortKey[] = ['received', 'fastest', 'lowest-fee']

const SORT_LABEL_KEY: Record<SortKey, 'sortReceived' | 'sortFastest' | 'sortLowestFee'> = {
  received: 'sortReceived',
  fastest: 'sortFastest',
  'lowest-fee': 'sortLowestFee',
}

interface Props {
  initial: Comparison
  payout: PayoutOption
  payoutLabel: string
}

export function CompareResults({ initial, payout, payoutLabel }: Props) {
  const [sort, setSort] = useState<SortKey>('received')
  const [data, setData] = useState<Comparison>(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const requestSeq = useRef(0)

  function changeSort(next: SortKey) {
    if (next === sort) return
    setSort(next)
    const seq = ++requestSeq.current
    setPending(true)
    setError(false)

    const params = new URLSearchParams({
      corridor: initial.corridorSlug,
      method: initial.deliveryMethod,
      amount: String(initial.amount),
      sort: next,
    })

    fetch(`/api/quotes?${params}`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<Comparison>
      })
      .then((payload) => {
        if (seq === requestSeq.current) setData(payload)
      })
      .catch(() => {
        if (seq === requestSeq.current) setError(true)
      })
      .finally(() => {
        if (seq === requestSeq.current) setPending(false)
      })
  }

  return (
    <ResultsView
      data={data}
      sort={sort}
      onSort={changeSort}
      pending={pending}
      error={error}
      payout={payout}
      payoutLabel={payoutLabel}
      className="mt-12"
    />
  )
}

interface ViewProps {
  data: Comparison
  sort: SortKey
  onSort: (sort: SortKey) => void
  pending: boolean
  error: boolean
  payout: PayoutOption
  payoutLabel: string
  className?: string
  /** Show when the quotes were captured under the heading (the live panel;
   *  /compare prints its own refresh line above). */
  showCapturedAt?: boolean
}

/** 24-hour Karachi time, fixed zone so server and client render the same. */
const CAPTURED_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Karachi',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/**
 * The results cards themselves, with no data fetching: /compare re-fetches only
 * on a sort change, the live ComparePanel on every edit, and both render this.
 */
export function ResultsView({
  data,
  sort,
  onSort,
  pending,
  error,
  payout,
  payoutLabel,
  className = '',
  showCapturedAt = false,
}: ViewProps) {
  const t = useTranslations('panel')
  const locale = useLocale()

  const speedLabel = (minutes: number | null, fallback: string): string => {
    if (locale === 'en') return fallback
    if (minutes === null) return t('speedVaries')
    if (minutes <= 30) return t('speedMinutes')
    if (minutes <= 360) return t('speedHours')
    if (minutes <= 1440) return t('speedSameDay')
    return t('speedFewDays')
  }

  const promoLabel = (note: string): string =>
    note === 'New-customer rate' ? t('promoNewCustomer') : note

  const symbol = data.currencySymbol

  return (
    <section className={className} aria-live="polite" aria-busy={pending}>
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-[26px] font-semibold text-ink">{t('resultsHeading')}</h2>
          {showCapturedAt && data.capturedAt && (
            <p className="mt-1 text-[13.5px] text-muted">
              {t('capturedAt', { time: CAPTURED_TIME.format(new Date(data.capturedAt)) })}
            </p>
          )}
        </div>

        <div
          // flex-wrap on the group, nowrap inside each pill: Urdu labels are
          // longer than the English.
          // Segmented control: the grey backing shows through the 3px gaps as
          // dividers, matching the field borders.
          className="flex w-full gap-[3px] overflow-hidden rounded-[10px] border-[3px] border-line bg-line sm:w-auto"
          role="group"
          aria-label={t('sortBy')}
        >
          {SORT_KEYS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onSort(value)}
              aria-pressed={sort === value}
              className={`flex-1 cursor-pointer px-3 py-3 text-[15px] font-bold whitespace-nowrap sm:flex-none sm:px-6 sm:text-[16px]
                          transition-colors ${
                            sort === value
                              ? 'bg-[#8DA63A] text-white'
                              : 'bg-white text-[#4A5A52] hover:bg-[#EEF3E3] hover:text-[#2F520B]'
                          }`}
            >
              {t(SORT_LABEL_KEY[value])}
            </button>
          ))}
        </div>
      </div>

      {isNamedBankAccount(payout) && (
        <p className="mt-3 max-w-[70ch] text-[13px] text-muted">
          {t('bankAccountRateNote', { account: payoutLabel })}
        </p>
      )}

      {error && (
        <p className="mt-4 text-[13px] text-[#A32D2D]" role="status">
          {t('refreshError')}
        </p>
      )}

      <div
        className="mt-7 hidden grid-cols-[1.7fr_.8fr_.8fr_1.4fr_220px] gap-6 px-7 text-[14.5px]
                   text-muted lg:grid"
        aria-hidden="true"
      >
        <span>{t('columnProvider')}</span>
        <span>{t('columnRate')}</span>
        <span>{t('columnFee')}</span>
        <span>{t('columnReceives')}</span>
        <span />
      </div>

      <ul className={`mt-3 grid gap-4 transition-opacity ${pending ? 'opacity-60' : ''}`}>
        {data.rows.length === 0 && (
          <li
            className={`rounded-[14px] border border-line bg-white p-8 text-center ${
              data.unavailable ? 'text-[#A32D2D]' : 'text-muted'
            }`}
          >
            {data.unavailable
              ? t('unavailable')
              : t('emptyState', { currency: data.fromCurrency })}
          </li>
        )}

        {data.rows.map((row) => {
          const q = row.quote
          const isBest = row.isBest
          const fast = (q.deliverySpeedMinutes ?? Number.POSITIVE_INFINITY) <= 600

          return (
            <li
              key={q.providerSlug}
              className={`grid items-center gap-5 rounded-[14px] border bg-white p-5 sm:p-7
                          lg:grid-cols-[1.7fr_.8fr_.8fr_1.4fr_220px] lg:gap-6 ${
                            isBest ? 'border-[3px] border-[#E2B55A]' : 'border-line'
                          }`}
            >
              {/* Provider */}
              <div className="flex items-center gap-4">
                <ProviderLogo
                  providerSlug={q.providerSlug}
                  providerName={q.providerName}
                  brandColor={q.brandColor}
                  brandTextColor={q.brandTextColor}
                  size="large"
                />
                <div className="min-w-0">
                  <div className="font-display text-[19px] leading-tight font-semibold">
                    {q.providerName}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {isBest && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-[3px] text-[12px] font-medium text-[#4A3608]">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-[11px] w-[11px]" aria-hidden="true">
                          <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
                        </svg>
                        {t('bestDeal')}
                      </span>
                    )}
                    {/* Sponsored placement sits below the winner, never above.
                        The label is not optional — see /how-we-rank. */}
                    {q.featured && !isBest && (
                      <span className="rounded-full bg-line-2 px-2.5 py-[3px] text-[12px] text-muted">
                        {t('sponsored')}
                      </span>
                    )}
                    {q.promo && q.promoNote && (
                      <span className="rounded-full bg-[#F1EAFB] px-2.5 py-[3px] text-[12px] text-[#7A4EB8]">
                        <bdi>{promoLabel(q.promoNote)}</bdi>
                      </span>
                    )}
                    {q.stale && (
                      <span className="rounded-full bg-gold-bg px-2.5 py-[3px] text-[12px] text-gold-dark">
                        {t('stale')}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[14px] text-muted">
                    {q.isBenchmark ? t('swiftTransfer') : t('bankDeposit')}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${
                        fast ? 'bg-[#E4F3EB] text-[#1C6B4A]' : 'bg-line-2 text-muted'
                      }`}
                    >
                      {fast && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-3 w-3" aria-hidden="true">
                          <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
                        </svg>
                      )}
                      <bdi>{speedLabel(q.deliverySpeedMinutes, q.deliverySpeedText)}</bdi>
                    </span>
                  </div>
                </div>
              </div>

              {/* Rate */}
              <div className="tabular-nums">
                <div className="text-[13.5px] text-muted lg:hidden">{t('columnRate')}</div>
                <div className="font-display text-[21px] leading-tight font-semibold">
                  {q.rate.toFixed(2)}
                </div>
                <div className="mt-0.5 text-[13.5px] text-muted">{t('perUnit', { symbol })}</div>
              </div>

              {/* Fee */}
              <div className="tabular-nums">
                <div className="text-[13.5px] text-muted lg:hidden">{t('columnFee')}</div>
                <div className="font-display text-[21px] leading-tight font-semibold">
                  {formatSend(symbol, q.fee.toFixed(2))}
                </div>
              </div>

              {/* Recipient gets */}
              <div className="tabular-nums">
                <div className="text-[13.5px] text-muted lg:hidden">{t('columnReceives')}</div>
                <b className="block font-display text-[28px] leading-none font-semibold tracking-[-0.02em]">
                  {formatPkr(q.amountReceived)}
                </b>
                <div className="my-3 h-1.5 overflow-hidden rounded-full bg-line-2">
                  <i
                    className="block h-full rounded-full"
                    style={{
                      width: `${row.barPercent}%`,
                      background: q.isBenchmark ? '#E0B4B4' : '#4F8A5B',
                    }}
                  />
                </div>
                <div
                  className={`text-[14px] ${
                    isBest
                      ? 'font-medium text-leaf'
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

              {/* Action */}
              <div>
                {q.isBenchmark ? (
                  <Link
                    // Through staticPath, not hard-coded, so Urdu readers stay in Urdu.
                    href={`${staticPath('how-we-rank', locale as Locale)}#bank-benchmark`}
                    className="flex h-[54px] w-full items-center justify-center rounded-[8px] border-[1.5px]
                               border-line bg-white text-[16px] font-medium text-ink no-underline
                               transition-[border-color,box-shadow] hover:border-[#85A61C]
                               hover:shadow-[0_0_0_1.5px_#85A61C]"
                  >
                    {t('whySoLow')}
                  </Link>
                ) : (
                  <a
                    href={`/go/${q.providerSlug}?corridor=${data.corridorSlug}&amount=${data.amount}&method=${data.deliveryMethod}`}
                    // Affiliate links must be marked for search engines.
                    rel="sponsored nofollow"
                    className={`flex h-[54px] w-full items-center justify-center gap-2 rounded-[8px]
                                text-[16px] font-bold whitespace-nowrap no-underline transition-colors ${
                                  isBest
                                    ? 'bg-gold text-ink hover:bg-[#DDA73C]'
                                    : 'border-[1.5px] border-line bg-white text-ink hover:border-[#85A61C] hover:shadow-[0_0_0_1.5px_#85A61C]'
                                }`}
                  >
                    {t('sendWith', { provider: q.providerName.split(' ')[0] })}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3.5 w-3.5" aria-hidden="true">
                      <path d="M7 17L17 7M8 7h9v9" />
                    </svg>
                  </a>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-5 flex flex-col justify-between gap-2 text-[12.5px] text-faint sm:flex-row sm:gap-6">
        <span>
          {t('disclaimerQuotes')}
          {data.amount !== data.quotedAtAmount &&
            ` ${t('disclaimerCaptured', { amount: formatSend(symbol, data.quotedAtAmount) })}`}
        </span>
        <span>{t('disclaimerCommission')}</span>
      </div>
    </section>
  )
}
