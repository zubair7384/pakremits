/**
 * PakRemits database schema (Postgres / Supabase).
 *
 * Money notes:
 *  - Sending-currency amounts (GBP, AED, ...) are `numeric(14,2)`.
 *  - PKR amounts are `numeric(18,2)` — a 2,000 GBP transfer is already ~750,000 PKR.
 *  - Rates are `numeric(18,6)`. PKR rates run 70–380, so 6 decimals is ample.
 *
 * Drizzle returns `numeric` as a string to avoid float drift on the wire. Parse
 * at the boundary with `toNum()` in lib/db/index.ts, never with implicit coercion.
 */
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/** Currencies we accept as the sending side. Target is always PKR. */
export const SEND_CURRENCIES = [
  'GBP',
  'AED',
  'SAR',
  'USD',
  'CAD',
  'AUD',
  'QAR',
  'EUR',
] as const
export type SendCurrency = (typeof SEND_CURRENCIES)[number]

/**
 * How the recipient in Pakistan actually gets the money. These are the values
 * behind the "Recipient gets it in" select on the home page.
 */
export const DELIVERY_METHODS = [
  'bank', // Bank account deposit (HBL, Meezan, ...)
  'wallet', // JazzCash / Easypaisa
  'neobank', // Sadapay / Nayapay
  'cash', // Cash pickup at an agent
  'rda', // Roshan Digital Account
] as const
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number]

/** Where a quote came from. Drives the provenance badge in /admin. */
export const QUOTE_SOURCES = ['api', 'scrape', 'manual'] as const
export type QuoteSource = (typeof QUOTE_SOURCES)[number]

export const providers = pgTable('providers', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  logoUrl: text('logo_url'),
  /** Hex colour for the square provider mark in the results table. */
  brandColor: text('brand_color').notNull().default('#8A8F8C'),
  /** Foreground colour for the mark, when the brand colour needs a light glyph. */
  brandTextColor: text('brand_text_color').notNull().default('#FFFFFF'),
  homepageUrl: text('homepage_url').notNull(),
  /**
   * Affiliate destination with `{clickId}` substituted at redirect time, e.g.
   * `https://wise.prf.hn/click/camref:1011l123/destination:{destination}?subid={clickId}`
   * Null means we link to the homepage with no commission.
   */
  affiliateUrlTemplate: text('affiliate_url_template'),
  affiliateNetwork: text('affiliate_network', {
    enum: ['impact', 'cj', 'partnerize', 'direct', 'none'],
  })
    .notNull()
    .default('none'),
  commissionNote: text('commission_note'),

  supportsBank: boolean('supports_bank').notNull().default(false),
  supportsWallet: boolean('supports_wallet').notNull().default(false),
  supportsNeobank: boolean('supports_neobank').notNull().default(false),
  supportsCash: boolean('supports_cash').notNull().default(false),
  supportsRda: boolean('supports_rda').notNull().default(false),

  /**
   * Pins the row directly *below* the best deal with a "Sponsored" label.
   * Never above. See /how-we-rank — this is a load-bearing promise.
   */
  featured: boolean('featured').notNull().default(false),
  /**
   * Synthetic reference row ("Typical high-street bank") used for the
   * "₨ X more than your bank" line. Excluded from the affiliate CTA.
   */
  isBenchmark: boolean('is_benchmark').notNull().default(false),
  active: boolean('active').notNull().default(true),
})

export const corridors = pgTable(
  'corridors',
  {
    id: serial('id').primaryKey(),
    /** URL segment, e.g. `uk` → /send-money-from-uk-to-pakistan */
    slug: text('slug').notNull().unique(),
    fromCurrency: text('from_currency', { enum: SEND_CURRENCIES }).notNull(),
    /** ISO 3166-1 alpha-2, e.g. GB. Providers key their APIs off country, not currency. */
    fromCountry: text('from_country').notNull(),
    /** Display name used in copy: "United Kingdom". */
    fromCountryName: text('from_country_name').notNull(),
    toCurrency: text('to_currency').notNull().default('PKR'),
    /** Symbol for the amount input prefix: £, $, د.إ ... */
    currencySymbol: text('currency_symbol').notNull(),
    active: boolean('active').notNull().default(true),
  },
  (t) => [uniqueIndex('corridors_from_currency_idx').on(t.fromCurrency)],
)

export const rateQuotes = pgTable(
  'rate_quotes',
  {
    id: serial('id').primaryKey(),
    providerId: integer('provider_id')
      .notNull()
      .references(() => providers.id, { onDelete: 'cascade' }),
    corridorId: integer('corridor_id')
      .notNull()
      .references(() => corridors.id, { onDelete: 'cascade' }),
    deliveryMethod: text('delivery_method', { enum: DELIVERY_METHODS }).notNull(),

    amountSent: numeric('amount_sent', { precision: 14, scale: 2 }).notNull(),
    /** Provider's exchange rate, including any markup they apply. */
    rate: numeric('rate', { precision: 18, scale: 6 }).notNull(),
    fee: numeric('fee', { precision: 14, scale: 2 }).notNull(),
    /** Denormalised so ranking never recomputes; always == computeReceived(...). */
    amountReceived: numeric('amount_received', { precision: 18, scale: 2 }).notNull(),

    deliverySpeedText: text('delivery_speed_text').notNull(),
    /** Rough minutes-to-arrive, for the "Fastest" sort. Null when unknown. */
    deliverySpeedMinutes: integer('delivery_speed_minutes'),

    promoFlag: boolean('promo_flag').notNull().default(false),
    promoNote: text('promo_note'),

    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
    source: text('source', { enum: QUOTE_SOURCES }).notNull(),
    /**
     * True when the adapter failed and we served the previous value. Surfaces as
     * the "stale" badge and feeds the stale-adapter list in /admin.
     */
    stale: boolean('stale').notNull().default(false),
  },
  (t) => [
    // The hot path: newest quote per provider/corridor/method/amount.
    index('rate_quotes_lookup_idx').on(
      t.corridorId,
      t.deliveryMethod,
      t.amountSent,
      t.capturedAt,
    ),
    index('rate_quotes_provider_idx').on(t.providerId, t.capturedAt),
  ],
)

export const midMarketRates = pgTable(
  'mid_market_rates',
  {
    id: serial('id').primaryKey(),
    fromCurrency: text('from_currency', { enum: SEND_CURRENCIES }).notNull(),
    toCurrency: text('to_currency').notNull().default('PKR'),
    rate: numeric('rate', { precision: 18, scale: 6 }).notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
    source: text('source').notNull(),
  },
  (t) => [index('mid_market_lookup_idx').on(t.fromCurrency, t.capturedAt)],
)

export const rateAlerts = pgTable(
  'rate_alerts',
  {
    id: serial('id').primaryKey(),
    /** Email address or E.164 phone number, depending on `channel`. */
    userContact: text('user_contact').notNull(),
    channel: text('channel', { enum: ['email', 'whatsapp', 'sms'] }).notNull(),
    fromCurrency: text('from_currency', { enum: SEND_CURRENCIES }).notNull(),
    targetRate: numeric('target_rate', { precision: 18, scale: 6 }).notNull(),
    direction: text('direction', { enum: ['above', 'below'] }).notNull(),

    /** Email alerts stay inactive until the double opt-in link is clicked. */
    confirmed: boolean('confirmed').notNull().default(false),
    active: boolean('active').notNull().default(true),
    wantsDigest: boolean('wants_digest').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Enforces the once-per-12-hours rule promised on the form. */
    lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
    /** Separate clock from lastTriggeredAt — a digest is not a trigger, and
     *  receiving one must not suppress a real threshold crossing. */
    lastDigestAt: timestamp('last_digest_at', { withTimezone: true }),
    /** Set when the double opt-in link is used. Kept alongside `confirmed`
     *  because "when did they consent" is the question a regulator asks. */
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    unsubscribeToken: text('unsubscribe_token').notNull().unique(),
  },
  (t) => [index('rate_alerts_eval_idx').on(t.fromCurrency, t.active, t.confirmed)],
)

export const affiliateClicks = pgTable(
  'affiliate_clicks',
  {
    id: serial('id').primaryKey(),
    providerId: integer('provider_id')
      .notNull()
      .references(() => providers.id, { onDelete: 'cascade' }),
    corridorId: integer('corridor_id').references(() => corridors.id, {
      onDelete: 'set null',
    }),
    amountSent: numeric('amount_sent', { precision: 14, scale: 2 }),
    deliveryMethod: text('delivery_method', { enum: DELIVERY_METHODS }),
    /** Our generated id, substituted into `{clickId}` for network attribution. */
    clickId: text('click_id').notNull().unique(),
    referrer: text('referrer'),
    utm: text('utm'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('affiliate_clicks_report_idx').on(t.createdAt, t.providerId)],
)

/**
 * Last successful run per cron job. Read by /admin to show "last cron run" and
 * to detect a silently dead GitHub Actions schedule.
 */
export const cronRuns = pgTable('cron_runs', {
  id: serial('id').primaryKey(),
  job: text('job').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  quotesWritten: integer('quotes_written').notNull().default(0),
  adaptersOk: integer('adapters_ok').notNull().default(0),
  adaptersFailed: integer('adapters_failed').notNull().default(0),
  error: text('error'),
})

export type Provider = typeof providers.$inferSelect
export type Corridor = typeof corridors.$inferSelect
export type RateQuote = typeof rateQuotes.$inferSelect
export type MidMarketRate = typeof midMarketRates.$inferSelect
export type RateAlert = typeof rateAlerts.$inferSelect
