/**
 * The read side: turning stored quotes into a ranked comparison table.
 *
 * Everything the public site renders comes through here, so the ranking promise
 * is enforced in one place. Note there is no `providers.featured` ordering in
 * the SQL — sponsorship is applied by `rankQuotes`, below the winner, never above.
 */
import { and, desc, eq, sql } from 'drizzle-orm'
import { db, toNum } from '@/lib/db'
import {
  type DeliveryMethod,
  type SendCurrency,
  corridors,
  midMarketRates,
  providers,
  rateQuotes,
} from '@/lib/db/schema'
import { CURRENCY_SYMBOLS, STANDARD_AMOUNTS } from '@/lib/corridors'
import { computeReceived, round } from '@/lib/ranking/compute'
import { type RankedQuote, type SortKey, rankQuotes, savingVsBenchmark } from '@/lib/ranking/rank'

/**
 * Typical high-street bank pricing, as a markup off mid-market plus a wire fee.
 *
 * The brief calls for a stored typical-bank benchmark per corridor, and this is
 * it. These are documented assumptions, not live data — the row is labelled
 * "Typical high-street bank", sorts last, and never carries an affiliate link.
 * Revisit the numbers if the major banks move; they change slowly.
 */
const BANK_BENCHMARK: Record<SendCurrency, { markupPercent: number; fee: number }> = {
  GBP: { markupPercent: 3.5, fee: 15 },
  EUR: { markupPercent: 3.2, fee: 15 },
  USD: { markupPercent: 3.8, fee: 25 },
  CAD: { markupPercent: 3.5, fee: 20 },
  AUD: { markupPercent: 3.5, fee: 20 },
  AED: { markupPercent: 2.8, fee: 40 },
  SAR: { markupPercent: 2.8, fee: 40 },
  QAR: { markupPercent: 2.8, fee: 40 },
}

/** A quote as the UI needs it: provider branding included, numbers pre-computed. */
export interface ComparisonRow {
  providerSlug: string
  providerName: string
  brandColor: string
  brandTextColor: string
  rate: number
  fee: number
  amountReceived: number
  deliverySpeedText: string
  deliverySpeedMinutes: number | null
  promo: boolean
  promoNote: string | null
  deliveryMethod: DeliveryMethod
  source: string
  stale: boolean
  capturedAt: Date
  featured: boolean
  isBenchmark: boolean
  /** Null for the benchmark row, which never links out. */
  hasAffiliateLink: boolean
}

export interface Comparison {
  corridorSlug: string
  fromCurrency: SendCurrency
  currencySymbol: string
  deliveryMethod: DeliveryMethod
  /** The amount the user asked for. */
  amount: number
  /** The stored grid amount the rates were captured at. See `quotedAtAmount`. */
  quotedAtAmount: number
  midMarketRate: number | null
  rows: RankedQuote<ComparisonRow>[]
  /** PKR the best provider beats the bank by. Null when no benchmark exists. */
  savingVsBank: number | null
  /** Oldest capture time across the rows — drives the "captured 14:28 PKT" line. */
  capturedAt: Date | null
  /** True when any row is older than 60 minutes. */
  stale: boolean
}

/**
 * Pick the grid amount closest to what the user typed.
 *
 * We refresh at 100/500/1000/2000 rather than on demand, so an arbitrary amount
 * reuses the nearest band's rate and fee and recomputes the received figure for
 * the real amount. Rate and fee are near-flat inside a band; the exception is a
 * promotional rate with a cap, which the adapters already resolve at capture
 * time. The UI shows which band was used so the number is never unexplained.
 */
export function nearestStandardAmount(currency: SendCurrency, amount: number): number {
  const grid = STANDARD_AMOUNTS[currency] ?? [100, 500, 1000, 2000]
  return grid.reduce((best, candidate) =>
    Math.abs(candidate - amount) < Math.abs(best - amount) ? candidate : best,
  )
}

/** Most recent mid-market rate for a currency. */
export async function latestMidMarket(currency: SendCurrency): Promise<number | null> {
  const [row] = await db
    .select({ rate: midMarketRates.rate })
    .from(midMarketRates)
    .where(eq(midMarketRates.fromCurrency, currency))
    .orderBy(desc(midMarketRates.capturedAt))
    .limit(1)

  return row ? toNum(row.rate) : null
}

/**
 * Build the bank benchmark row from the live mid-market rate.
 *
 * Computed rather than stored so the saving figure moves with the market, which
 * the copy rules require — only the markup and fee are constants.
 */
function benchmarkRow(
  currency: SendCurrency,
  amount: number,
  midMarket: number,
  method: DeliveryMethod,
): ComparisonRow {
  const { markupPercent, fee } = BANK_BENCHMARK[currency]
  const rate = round(midMarket * (1 - markupPercent / 100), 6)

  return {
    providerSlug: 'typical-bank',
    providerName: 'Typical high-street bank',
    brandColor: '#8A8F8C',
    brandTextColor: '#FFFFFF',
    rate,
    fee,
    amountReceived: computeReceived(amount, rate, fee),
    deliverySpeedText: '2–4 days',
    deliverySpeedMinutes: 4320,
    promo: false,
    promoNote: null,
    deliveryMethod: method,
    source: 'benchmark',
    stale: false,
    capturedAt: new Date(),
    featured: false,
    isBenchmark: true,
    hasAffiliateLink: false,
  }
}

const STALE_AFTER_MS = 60 * 60 * 1000

/**
 * The comparison table for one corridor, method, and amount.
 *
 * Uses Postgres `DISTINCT ON` to take only the newest quote per provider, which
 * is far cheaper than a window function over a table that grows by ~4,000 rows a
 * day.
 */
export async function getComparison(options: {
  corridorSlug: string
  method?: DeliveryMethod
  amount?: number
  sortBy?: SortKey
  includeBenchmark?: boolean
}): Promise<Comparison | null> {
  const { corridorSlug, method = 'bank', sortBy = 'received', includeBenchmark = true } = options

  const [corridor] = await db
    .select()
    .from(corridors)
    .where(and(eq(corridors.slug, corridorSlug), eq(corridors.active, true)))
    .limit(1)

  if (!corridor) return null

  const currency = corridor.fromCurrency
  const amount = options.amount ?? (currency === 'GBP' ? 500 : STANDARD_AMOUNTS[currency][1])
  const quotedAtAmount = nearestStandardAmount(currency, amount)

  /**
   * `DISTINCT ON (provider_id)` takes only the newest quote per provider inside
   * Postgres. The alternative — fetching every quote for the slot and reducing
   * in JS — would pull weeks of history to keep a handful of rows, since this
   * table grows by thousands of rows a day.
   */
  const rows = (await db.execute(sql`
    SELECT DISTINCT ON (${rateQuotes.providerId})
      ${providers.slug}                 AS provider_slug,
      ${providers.name}                 AS provider_name,
      ${providers.brandColor}           AS brand_color,
      ${providers.brandTextColor}       AS brand_text_color,
      ${providers.featured}             AS featured,
      ${providers.isBenchmark}          AS is_benchmark,
      ${providers.affiliateUrlTemplate} AS affiliate_url_template,
      ${rateQuotes.rate}                AS rate,
      ${rateQuotes.fee}                 AS fee,
      ${rateQuotes.deliverySpeedText}   AS delivery_speed_text,
      ${rateQuotes.deliverySpeedMinutes} AS delivery_speed_minutes,
      ${rateQuotes.promoFlag}           AS promo_flag,
      ${rateQuotes.promoNote}           AS promo_note,
      ${rateQuotes.source}              AS source,
      ${rateQuotes.stale}               AS stale,
      ${rateQuotes.capturedAt}          AS captured_at
    FROM ${rateQuotes}
    INNER JOIN ${providers} ON ${rateQuotes.providerId} = ${providers.id}
    WHERE ${rateQuotes.corridorId} = ${corridor.id}
      AND ${rateQuotes.deliveryMethod} = ${method}
      AND ${rateQuotes.amountSent} = ${String(quotedAtAmount)}
      AND ${providers.active} = true
    ORDER BY ${rateQuotes.providerId}, ${rateQuotes.capturedAt} DESC
  `)) as unknown as {
    provider_slug: string
    provider_name: string
    brand_color: string
    brand_text_color: string
    featured: boolean
    is_benchmark: boolean
    affiliate_url_template: string | null
    rate: string
    fee: string
    delivery_speed_text: string
    delivery_speed_minutes: number | null
    promo_flag: boolean
    promo_note: string | null
    source: string
    stale: boolean
    captured_at: Date
  }[]

  const midMarket = await latestMidMarket(currency)

  const comparisonRows: ComparisonRow[] = rows
    // The stored benchmark provider is replaced by a live-computed row below.
    .filter((row) => !row.is_benchmark)
    .map((row) => {
      const rate = toNum(row.rate)
      const fee = toNum(row.fee)
      return {
        providerSlug: row.provider_slug,
        providerName: row.provider_name,
        brandColor: row.brand_color,
        brandTextColor: row.brand_text_color,
        rate,
        fee,
        // Recomputed for the requested amount rather than reusing the stored
        // figure, which was calculated at `quotedAtAmount`.
        amountReceived: computeReceived(amount, rate, fee),
        deliverySpeedText: row.delivery_speed_text,
        deliverySpeedMinutes: row.delivery_speed_minutes,
        promo: row.promo_flag,
        promoNote: row.promo_note,
        deliveryMethod: method,
        source: row.source,
        stale: row.stale,
        capturedAt: new Date(row.captured_at),
        featured: row.featured,
        isBenchmark: false,
        hasAffiliateLink: Boolean(row.affiliate_url_template),
      }
    })

  if (includeBenchmark && midMarket !== null && comparisonRows.length > 0) {
    comparisonRows.push(benchmarkRow(currency, amount, midMarket, method))
  }

  const ranked = rankQuotes(comparisonRows, sortBy)

  const captureTimes = comparisonRows.filter((r) => !r.isBenchmark).map((r) => r.capturedAt)
  const oldest = captureTimes.length
    ? new Date(Math.min(...captureTimes.map((d) => d.getTime())))
    : null

  return {
    corridorSlug: corridor.slug,
    fromCurrency: currency,
    currencySymbol: CURRENCY_SYMBOLS[currency],
    deliveryMethod: method,
    amount,
    quotedAtAmount,
    midMarketRate: midMarket,
    rows: ranked,
    savingVsBank: savingVsBenchmark(ranked),
    capturedAt: oldest,
    stale:
      comparisonRows.some((r) => r.stale) ||
      (oldest !== null && Date.now() - oldest.getTime() > STALE_AFTER_MS),
  }
}

export interface RateSeries {
  currency: SendCurrency
  points: { date: Date; rate: number }[]
  latest: number | null
  /** Percent change from the first point to the latest. */
  changePercent: number | null
}

/**
 * Daily mid-market series for the hero ticker and the corridor-page charts.
 *
 * Collapses to one point per day — the cron writes a row every 15 minutes, and
 * a 30-day sparkline wants 30 points, not 2,880.
 */
export async function getMidMarketSeries(
  currency: SendCurrency,
  days = 7,
): Promise<RateSeries> {
  const rows = (await db.execute(sql`
    SELECT DISTINCT ON (day)
      date_trunc('day', ${midMarketRates.capturedAt}) AS day,
      ${midMarketRates.rate} AS rate
    FROM ${midMarketRates}
    WHERE ${midMarketRates.fromCurrency} = ${currency}
      AND ${midMarketRates.capturedAt} > now() - make_interval(days => ${days})
    ORDER BY day, ${midMarketRates.capturedAt} DESC
  `)) as unknown as { day: Date; rate: string }[]

  const points = rows
    .map((row) => ({ date: new Date(row.day), rate: toNum(row.rate) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const first = points.at(0)?.rate ?? null
  const latest = points.at(-1)?.rate ?? null

  return {
    currency,
    points,
    latest,
    changePercent:
      first !== null && latest !== null && first > 0
        ? round(((latest - first) / first) * 100, 2)
        : null,
  }
}

/** Best available rate per corridor, for the home page's corridor chips. */
export async function getBestRatePerCorridor(): Promise<
  { slug: string; countryName: string; currency: SendCurrency; bestRate: number | null }[]
> {
  const corridorRows = await db.select().from(corridors).where(eq(corridors.active, true))

  return Promise.all(
    corridorRows.map(async (corridor) => {
      const comparison = await getComparison({
        corridorSlug: corridor.slug,
        includeBenchmark: false,
      })
      const best = comparison?.rows.find((r) => r.isBest)

      return {
        slug: corridor.slug,
        countryName: corridor.fromCountryName,
        currency: corridor.fromCurrency,
        bestRate: best ? best.quote.rate : null,
      }
    }),
  )
}
