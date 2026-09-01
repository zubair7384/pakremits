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

/** Symbols are per-currency, not per-corridor. */
export const CURRENCY_SYMBOLS: Record<SendCurrency, string> = {
  GBP: '£',
  AED: 'د.إ',
  SAR: '﷼',
  USD: '$',
  CAD: 'C$',
  AUD: 'A$',
  QAR: 'ر.ق',
  EUR: '€',
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
