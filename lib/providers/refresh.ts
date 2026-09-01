/**
 * The refresh loop: fetch every provider × corridor × method × amount, and
 * persist the results.
 *
 * The one rule here is that nothing may throw past this boundary. A provider
 * changing its JSON shape at 3am must degrade to a stale badge on one row, not
 * an empty comparison table.
 */
import { and, desc, eq, sql as raw } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  type Corridor,
  type DeliveryMethod,
  type Provider,
  corridors,
  providers,
  rateQuotes,
} from '@/lib/db/schema'
import { CORRIDORS, STANDARD_AMOUNTS } from '@/lib/corridors'
import { computeReceived } from '@/lib/ranking/compute'
import { adaptersFor } from './registry'
import { AdapterError, jitteredDelay, type Quote, type QuoteRequest } from './types'

/** Delivery methods we ask every adapter about. */
const METHODS: readonly DeliveryMethod[] = ['bank', 'wallet', 'cash'] as const

export interface RefreshResult {
  quotesWritten: number
  adaptersOk: number
  adaptersFailed: number
  staleServed: number
  failures: { provider: string; corridor: string; method: string; error: string }[]
  durationMs: number
}

/**
 * Canonical received amount.
 *
 * Always computed in the `deducted` model regardless of how the provider itself
 * frames its fee, so every row answers the same question: "I have `amount` to
 * spend in total — what lands in Pakistan?" Comparing a fee-on-top provider at
 * face value against a fee-deducted one would silently favour the former.
 */
export function canonicalReceived(amount: number, quote: Quote): number {
  return computeReceived(amount, quote.rate, quote.fee, 'deducted')
}

/**
 * Last known good quote for this exact slot, used when an adapter fails.
 * Returns null when we have never successfully quoted it.
 */
async function lastGoodQuote(
  providerId: number,
  corridorId: number,
  method: DeliveryMethod,
  amount: number,
) {
  const [row] = await db
    .select()
    .from(rateQuotes)
    .where(
      and(
        eq(rateQuotes.providerId, providerId),
        eq(rateQuotes.corridorId, corridorId),
        eq(rateQuotes.deliveryMethod, method),
        eq(rateQuotes.amountSent, String(amount)),
        eq(rateQuotes.stale, false),
      ),
    )
    .orderBy(desc(rateQuotes.capturedAt))
    .limit(1)

  return row ?? null
}

/**
 * Refresh one provider/corridor/method/amount slot.
 *
 * On success writes a fresh row. On failure re-writes the last good quote with
 * `stale: true` so the page keeps a number and the UI can say how old it is.
 */
async function refreshSlot(
  adapter: ReturnType<typeof adaptersFor>[number],
  provider: Provider,
  corridor: Corridor,
  request: QuoteRequest,
  result: RefreshResult,
): Promise<void> {
  try {
    const quote = await adapter.getQuote(request)
    const received = canonicalReceived(request.amount, quote)

    if (received <= 0) {
      throw new AdapterError(adapter.slug, `computed a non-positive receive amount`)
    }

    await db.insert(rateQuotes).values({
      providerId: provider.id,
      corridorId: corridor.id,
      deliveryMethod: request.method,
      amountSent: String(request.amount),
      rate: String(quote.rate),
      fee: String(quote.fee),
      amountReceived: String(received),
      deliverySpeedText: quote.deliverySpeedText,
      deliverySpeedMinutes: quote.deliverySpeedMinutes,
      promoFlag: quote.promo,
      promoNote: quote.promoNote,
      source: quote.source,
      stale: false,
      capturedAt: quote.capturedAt,
    })

    result.quotesWritten += 1
    result.adaptersOk += 1
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    result.adaptersFailed += 1
    result.failures.push({
      provider: adapter.slug,
      corridor: corridor.slug,
      method: request.method,
      error: message,
    })
    console.error(
      `[refresh] ${adapter.slug} ${corridor.slug}/${request.method}/${request.amount} failed:`,
      message,
    )

    // Degrade to the last good number rather than dropping the provider.
    const previous = await lastGoodQuote(
      provider.id,
      corridor.id,
      request.method,
      request.amount,
    ).catch(() => null)

    if (previous) {
      await db
        .insert(rateQuotes)
        .values({ ...previous, id: undefined, stale: true, capturedAt: new Date() })
        .catch((e) => console.error('[refresh] stale write failed:', e))
      result.staleServed += 1
    }
  }
}

/**
 * Full refresh across every active corridor, method, and standard amount.
 *
 * Runs corridors sequentially and providers in parallel within a slot: that
 * keeps concurrent load on any single provider host to one request at a time
 * while still finishing the whole grid inside a function timeout.
 */
export async function refreshAllRates(): Promise<RefreshResult> {
  const started = Date.now()
  const result: RefreshResult = {
    quotesWritten: 0,
    adaptersOk: 0,
    adaptersFailed: 0,
    staleServed: 0,
    failures: [],
    durationMs: 0,
  }

  const [providerRows, corridorRows] = await Promise.all([
    db.select().from(providers).where(eq(providers.active, true)),
    db.select().from(corridors).where(eq(corridors.active, true)),
  ])

  const providerBySlug = new Map(providerRows.map((p) => [p.slug, p]))

  for (const corridor of corridorRows) {
    const config = CORRIDORS.find((c) => c.slug === corridor.slug)
    if (!config) {
      console.warn(`[refresh] no static config for corridor "${corridor.slug}", skipping`)
      continue
    }

    const amounts = STANDARD_AMOUNTS[corridor.fromCurrency] ?? [100, 500, 1000, 2000]

    for (const method of METHODS) {
      for (const amount of amounts) {
        const request: QuoteRequest = {
          from: corridor.fromCurrency,
          fromCountry: config.fromCountry,
          fromCountry3: config.fromCountry3,
          to: 'PKR',
          amount,
          method,
        }

        const adapters = adaptersFor(request)

        await Promise.all(
          adapters.map(async (adapter) => {
            const provider = providerBySlug.get(adapter.slug)
            if (!provider) {
              console.warn(`[refresh] adapter "${adapter.slug}" has no provider row; run the seed`)
              return
            }
            await refreshSlot(adapter, provider, corridor, request, result)
          }),
        )

        // Be a good citizen: space out our requests to each provider.
        await jitteredDelay()
      }
    }
  }

  result.durationMs = Date.now() - started
  return result
}

/**
 * Delete quotes older than `days`. Called at the end of each cron run so the
 * free-tier Supabase instance does not fill up — at 96 refreshes a day across
 * the full grid this table grows fast.
 */
export async function pruneOldQuotes(days = 45): Promise<number> {
  const deleted = await db
    .delete(rateQuotes)
    .where(raw`${rateQuotes.capturedAt} < now() - make_interval(days => ${days})`)
    .returning({ id: rateQuotes.id })

  return deleted.length
}
