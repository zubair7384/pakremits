/**
 * The eight sending corridors, as static config.
 *
 * These are stable facts (ISO codes, symbols, URL slugs) that the seed script
 * writes into the `corridors` table and that the cron loop iterates. Keeping
 * them in code means a new corridor is a one-line change plus a reseed.
 */
import type { SendCurrency } from './db/schema'

export interface CorridorConfig {
  slug: string
  fromCurrency: SendCurrency
  /** ISO 3166-1 alpha-2 — Wise's `profileCountry`. */
  fromCountry: string
  /** ISO 3166-1 alpha-3 — Remitly's conduit format. */
  fromCountry3: string
  fromCountryName: string
  /** Used in page titles: "send money from the UK to Pakistan". */
  articleName: string
}

export const CORRIDORS: readonly CorridorConfig[] = [
  {
    slug: 'uk',
    fromCurrency: 'GBP',
    fromCountry: 'GB',
    fromCountry3: 'GBR',
    fromCountryName: 'United Kingdom',
    articleName: 'the UK',
  },
  {
    slug: 'uae',
    fromCurrency: 'AED',
    fromCountry: 'AE',
    fromCountry3: 'ARE',
    fromCountryName: 'United Arab Emirates',
    articleName: 'the UAE',
  },
  {
    slug: 'saudi-arabia',
    fromCurrency: 'SAR',
    fromCountry: 'SA',
    fromCountry3: 'SAU',
    fromCountryName: 'Saudi Arabia',
    articleName: 'Saudi Arabia',
  },
  {
    slug: 'usa',
    fromCurrency: 'USD',
    fromCountry: 'US',
    fromCountry3: 'USA',
    fromCountryName: 'United States',
    articleName: 'the USA',
  },
  {
    slug: 'canada',
    fromCurrency: 'CAD',
    fromCountry: 'CA',
    fromCountry3: 'CAN',
    fromCountryName: 'Canada',
    articleName: 'Canada',
  },
  {
    slug: 'australia',
    fromCurrency: 'AUD',
    fromCountry: 'AU',
    fromCountry3: 'AUS',
    fromCountryName: 'Australia',
    articleName: 'Australia',
  },
  {
    slug: 'qatar',
    fromCurrency: 'QAR',
    fromCountry: 'QA',
    fromCountry3: 'QAT',
    fromCountryName: 'Qatar',
    articleName: 'Qatar',
  },
  {
    slug: 'eurozone',
    fromCurrency: 'EUR',
    // Ireland stands in for the Eurozone: it is the euro country most of these
    // APIs price consistently, and the rate is identical across the bloc.
    fromCountry: 'IE',
    fromCountry3: 'IRL',
    fromCountryName: 'Eurozone',
    articleName: 'the Eurozone',
  },
] as const

/**
 * Symbols are per-currency, not per-corridor.
 *
 * The Gulf three carry their ISO code rather than a glyph. د.إ, ﷼ and ر.ق are
 * Arabic-script, so they stay Arabic on the English pages, flip side under the
 * bidi algorithm next to a Latin amount, and render unjoined in satori. "SAR
 * 1,000" is unambiguous in both locales and in the OG images. Use `formatSend`
 * to put one in front of a number — these need a space, the glyphs do not.
 */
export const CURRENCY_SYMBOLS: Record<SendCurrency, string> = {
  GBP: '£',
  AED: 'AED',
  SAR: 'SAR',
  USD: '$',
  CAD: 'C$',
  AUD: 'A$',
  QAR: 'QAR',
  EUR: '€',
}

/**
 * A sent amount with its symbol: "£500", "C$500", but "SAR 500".
 *
 * A code is a word and needs the space; a glyph does not. Tested on the last
 * character so "C$" and "A$" stay tight against the number.
 */
export function formatSend(symbol: string, amount: number | string): string {
  const value = typeof amount === 'number' ? amount.toLocaleString('en-GB') : amount
  return /[A-Za-z]$/.test(symbol) ? `${symbol} ${value}` : `${symbol}${value}`
}

/**
 * Amounts we refresh on every cron run, per sending currency.
 *
 * Chosen so the grid straddles the fee-vs-rate crossover: at 100 a flat fee
 * dominates, by 2000 the rate markup does. Providers that win at one end often
 * lose at the other, and the comparison should show that.
 */
export const STANDARD_AMOUNTS: Record<SendCurrency, readonly number[]> = {
  GBP: [100, 500, 1000, 2000],
  EUR: [100, 500, 1000, 2000],
  USD: [100, 500, 1000, 2000],
  CAD: [100, 500, 1000, 2000],
  AUD: [100, 500, 1000, 2000],
  // Gulf currencies are pegged near 3.67/3.75 to the dollar, so round dollar-ish
  // amounts land on odd local numbers. These are the amounts senders actually use.
  AED: [500, 1000, 3000, 5000],
  SAR: [500, 1000, 3000, 5000],
  QAR: [500, 1000, 3000, 5000],
}

export function corridorBySlug(slug: string): CorridorConfig | undefined {
  return CORRIDORS.find((c) => c.slug === slug)
}

export function corridorByCurrency(currency: SendCurrency): CorridorConfig | undefined {
  return CORRIDORS.find((c) => c.fromCurrency === currency)
}

/**
 * The amount a corridor opens on, and the figure the panel resets to when the
 * user switches into it. The second entry of the grid: 500 for the currencies
 * that use round hundreds, 1000 for the Gulf ones where 500 is a small sum.
 */
export function defaultAmountFor(currency: SendCurrency): number {
  const grid = STANDARD_AMOUNTS[currency] ?? [100, 500, 1000, 2000]
  return grid[1] ?? grid[0]
}
