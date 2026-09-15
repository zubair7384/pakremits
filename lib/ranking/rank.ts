/**
 * Ordering rules for the comparison table.
 *
 * The promise on /how-we-rank and in the footer is that ranking is by amount
 * received and nothing else. Commission never enters this file — there is no
 * parameter for it, deliberately, so it cannot be added by accident.
 */
import { round } from './compute'

export type SortKey = 'received' | 'fastest' | 'lowest-fee'

export interface RankableQuote {
  providerSlug: string
  providerName: string
  amountReceived: number
  fee: number
  rate: number
  /** Minutes until arrival, for the "Fastest" sort. Unknown sorts last. */
  deliverySpeedMinutes: number | null
  /** Pins below the best deal with a "Sponsored" label. Never above it. */
  featured: boolean
  /** The "Bank Transfer" reference row. Always sorts last. */
  isBenchmark: boolean
}

export interface RankedQuote<T extends RankableQuote> {
  quote: T
  /** 1-based position among non-benchmark rows. */
  position: number
  isBest: boolean
  /** PKR difference against the best non-benchmark row. Negative means worse. */
  diffFromBest: number
  /** Width of the design's progress bar, 0–100, relative to the best row. */
  barPercent: number
}

/** Nulls sort last, so an unknown speed never wins the "Fastest" tab. */
function bySpeed(a: RankableQuote, b: RankableQuote): number {
  if (a.deliverySpeedMinutes === b.deliverySpeedMinutes) return 0
  if (a.deliverySpeedMinutes === null) return 1
  if (b.deliverySpeedMinutes === null) return -1
  return a.deliverySpeedMinutes - b.deliverySpeedMinutes
}

/**
 * Comparators per sort tab. Every one of them ends by falling through to
 * amount received, then provider name, so the order is total and stable
 * regardless of the input order.
 */
const COMPARATORS: Record<SortKey, (a: RankableQuote, b: RankableQuote) => number> = {
  received: (a, b) =>
    b.amountReceived - a.amountReceived ||
    bySpeed(a, b) ||
    a.fee - b.fee ||
    a.providerName.localeCompare(b.providerName),

  fastest: (a, b) =>
    bySpeed(a, b) ||
    b.amountReceived - a.amountReceived ||
    a.providerName.localeCompare(b.providerName),

  'lowest-fee': (a, b) =>
    a.fee - b.fee ||
    b.amountReceived - a.amountReceived ||
    a.providerName.localeCompare(b.providerName),
}

/**
 * Sort quotes and annotate each with its position, best-deal flag, and the
 * deltas the design renders.
 *
 * Ordering is applied in three passes:
 *  1. Sort real providers by the chosen key.
 *  2. Move a `featured` provider to index 1 — below the winner, never above.
 *  3. Append benchmark rows (the bank), which never compete for the top slot.
 */
export function rankQuotes<T extends RankableQuote>(
  quotes: readonly T[],
  sortBy: SortKey = 'received',
): RankedQuote<T>[] {
  const real = quotes.filter((q) => !q.isBenchmark)
  const benchmarks = quotes.filter((q) => q.isBenchmark)

  const sorted = [...real].sort(COMPARATORS[sortBy])

  // Sponsored placement: directly below the best deal. If a featured provider
  // already won on merit it stays at the top — we do not demote it either.
  const featuredIndex = sorted.findIndex((q) => q.featured)
  if (featuredIndex > 1) {
    const [featured] = sorted.splice(featuredIndex, 1)
    sorted.splice(1, 0, featured)
  }

  // "Best" always means the highest amount received, even when the user is
  // looking at the "Fastest" tab — otherwise the gold highlight would contradict
  // the ranking promise.
  const best = real.reduce(
    (acc, q) => (acc === null || q.amountReceived > acc.amountReceived ? q : acc),
    null as T | null,
  )
  const bestAmount = best?.amountReceived ?? 0

  const annotate = (quote: T, index: number): RankedQuote<T> => ({
    quote,
    position: index + 1,
    isBest: !quote.isBenchmark && quote.providerSlug === best?.providerSlug,
    diffFromBest: round(quote.amountReceived - bestAmount, 2),
    barPercent:
      bestAmount > 0 ? round(Math.min((quote.amountReceived / bestAmount) * 100, 100), 2) : 0,
  })

  return [
    ...sorted.map((q, i) => annotate(q, i)),
    ...benchmarks.map((q, i) => annotate(q, sorted.length + i)),
  ]
}

/**
 * PKR saved by using the best provider instead of the bank benchmark. This is
 * the "₨ 9,608 more than your bank" line, and it must always be computed from
 * live quotes rather than stored, per the copy rules.
 *
 * Returns null when no benchmark exists for the corridor, so callers hide the
 * line rather than printing a fabricated saving.
 */
export function savingVsBenchmark<T extends RankableQuote>(
  ranked: readonly RankedQuote<T>[],
): number | null {
  const best = ranked.find((r) => r.isBest)
  const benchmark = ranked.find((r) => r.quote.isBenchmark)
  if (!best || !benchmark) return null
  return round(best.quote.amountReceived - benchmark.quote.amountReceived, 2)
}
