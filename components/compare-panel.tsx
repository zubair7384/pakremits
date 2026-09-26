'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Comparison } from '@/lib/quotes'
import type { SortKey } from '@/lib/ranking/rank'
import type { PayoutOption } from '@/components/select-icons'
import { CompareSearch, type SearchCorridorOption, type SearchSelection } from '@/components/compare-search'
import { ResultsView } from '@/components/compare-results'
import { PAYOUT_METHOD, initialPayoutOption } from '@/lib/payout'

/**
 * The comparison panel.
 *
 * Server-rendered with real data on first paint, then updates in place from
 * /api/quotes when the user changes anything. All ranking and arithmetic stays
 * on the server — this component only renders what it is given, so there is one
 * implementation of the ranking rules rather than two that can drift.
 *
 * It wears the same search bar and result cards as /compare; the difference is
 * that nothing navigates — every edit re-ranks the list on this page.
 */

interface Props {
  initial: Comparison
  corridors: SearchCorridorOption[]
  /** Preserve the named account selection when its quote uses the bank rail. */
  initialPayout?: PayoutOption
}

/** The old panel's control ids, which deep links and the e2e suite rely on. */
const PANEL_IDS = { from: 'from', method: 'method', amount: 'amt' }

export function ComparePanel({ initial, corridors, initialPayout }: Props) {
  const t = useTranslations('panel')
  const tm = useTranslations('methods')

  const [corridor, setCorridor] = useState(initial.corridorSlug)
  const [payoutOption, setPayoutOption] = useState<PayoutOption>(() =>
    initialPayout ?? initialPayoutOption(initial.deliveryMethod),
  )
  const method = PAYOUT_METHOD[payoutOption]
  const [amountText, setAmountText] = useState(String(initial.amount))
  const [sort, setSort] = useState<SortKey>('received')
  const [data, setData] = useState<Comparison>(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)

  const headingId = useId()
  // Lets a slow response from an earlier keystroke lose to a newer one.
  const requestSeq = useRef(0)

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
      setError(false)

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
          setError(true)
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

  function onSelectionChange(selection: SearchSelection) {
    setCorridor(selection.corridor)
    setPayoutOption(selection.payout)
    setAmountText(selection.amountText)
  }

  const payoutLabels: Record<PayoutOption, string> = {
    bank: tm('bank'),
    jazzcash: 'JazzCash',
    easypaisa: 'Easypaisa',
    sadapay: 'SadaPay',
    nayapay: 'NayaPay',
    cash: tm('cash'),
    rda: tm('rda'),
  }

  return (
    <section id="compare" aria-labelledby={headingId} className="relative">
      <h2 id={headingId} className="sr-only">
        {t('heading')}
      </h2>

      <CompareSearch
        corridors={corridors}
        initialCorridor={initial.corridorSlug}
        initialPayout={payoutOption}
        initialAmount={initial.amount}
        layout="row"
        ids={PANEL_IDS}
        onSelectionChange={onSelectionChange}
      />

      <ResultsView
        data={data}
        sort={sort}
        onSort={setSort}
        pending={pending}
        error={error}
        payout={payoutOption}
        payoutLabel={payoutLabels[payoutOption]}
        className="mt-12"
        showCapturedAt
      />
    </section>
  )
}
