/**
 * The savings ledger: one row per affiliate click.
 *
 * Rules that make the total defensible, and which /how-we-rank#savings states
 * in the same terms:
 *
 *  - A row is written only when a real person clicks through to a provider.
 *    Nothing is ever backfilled, projected, or written for a page view.
 *  - The figures are the ones current at the moment of the click. If the quote
 *    moves a minute later the ledger does not follow it.
 *  - No benchmark for the corridor means `savingPkr` is null and the row is
 *    excluded from every total. It is never replaced with a default.
 */
import { and, desc, eq } from 'drizzle-orm'
import { db, toNum } from '@/lib/db'
import {
  type DeliveryMethod,
  rateQuotes,
  savingsLedger,
} from '@/lib/db/schema'
import { computeReceived, round } from '@/lib/ranking/compute'
import { nearestStandardAmount } from '@/lib/quotes'
import type { SendCurrency } from '@/lib/db/schema'
import { benchmarkReceived, getBenchmark } from './benchmarks'

export interface LedgerInput {
  affiliateClickId: number
  providerId: number
  corridorId: number | null
  currency: SendCurrency | null
  amount: number | null
  method: DeliveryMethod | null
}

/**
 * Record what this click avoided paying.
 *
 * Returns the saving in PKR, or null when it could not be established — which
 * covers a missing corridor, a missing amount, no live quote for the provider,
 * or no benchmark. Callers ignore the result: the redirect must happen either
 * way, and a lost ledger row is a reporting problem, not a user-facing one.
 */
export async function recordSaving(input: LedgerInput): Promise<number | null> {
  const { affiliateClickId, providerId, corridorId, currency, amount, method } = input

  // Without a corridor, an amount and a rail there is nothing to price against.
  // The click row still exists; it simply produces no ledger entry.
  if (corridorId === null || amount === null || method === null || currency === null) {
    return null
  }

  try {
    // The provider's most recent quote for the band this amount falls in.
    const quotedAt = nearestStandardAmount(currency, amount)

    const [quote] = await db
      .select({ rate: rateQuotes.rate, fee: rateQuotes.fee })
      .from(rateQuotes)
      .where(
        and(
          eq(rateQuotes.providerId, providerId),
          eq(rateQuotes.corridorId, corridorId),
          eq(rateQuotes.deliveryMethod, method),
          eq(rateQuotes.amountSent, String(quotedAt)),
        ),
      )
      .orderBy(desc(rateQuotes.capturedAt))
      .limit(1)

    if (!quote) return null

    // Recomputed at the amount the user actually entered, matching what the
    // comparison table showed them — not the stored figure for the band.
    const providerReceived = computeReceived(amount, toNum(quote.rate), toNum(quote.fee))

    const benchmark = await getBenchmark(corridorId, method)
    const bankReceived = benchmarkReceived(benchmark, amount)

    // Null propagates deliberately. A click in a corridor we cannot benchmark
    // is recorded and then left out of the totals.
    const saving = bankReceived === null ? null : round(providerReceived - bankReceived, 2)

    await db
      .insert(savingsLedger)
      .values({
        affiliateClickId,
        corridorId,
        providerId,
        amountSent: String(amount),
        providerReceivedPkr: String(providerReceived),
        bankReceivedPkr: bankReceived === null ? null : String(bankReceived),
        savingPkr: saving === null ? null : String(saving),
      })
      // One ledger row per click. A retried redirect must not double-count.
      .onConflictDoNothing({ target: savingsLedger.affiliateClickId })

    return saving
  } catch (error) {
    console.error('[proof] recordSaving failed:', error)
    return null
  }
}
