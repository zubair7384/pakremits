/**
 * The contract every provider adapter implements.
 *
 * Adapters are deliberately dumb: they fetch, parse, and return. They do not
 * touch the database, do not decide ranking, and do not retry. Caching, stale
 * fallback, and persistence all live in lib/providers/refresh.ts, so an adapter
 * can be tested against a saved fixture with no I/O at all.
 */
import type { DeliveryMethod, QuoteSource, SendCurrency } from '@/lib/db/schema'
import type { FeeModel } from '@/lib/ranking/compute'

export interface QuoteRequest {
  from: SendCurrency
  /** ISO 3166-1 alpha-2 of the sending country. Most APIs key off this, not currency. */
  fromCountry: string
  /** ISO 3166-1 alpha-3, which Remitly and others use instead. */
  fromCountry3: string
  to: 'PKR'
  /**
   * What the sender parts with in total, in the sending currency. This is a
   * budget, not a provider-specific "send amount" — see `feeModel`.
   */
  amount: number
  method: DeliveryMethod
}

export interface Quote {
  providerSlug: string
  /** The provider's rate, markup already baked in. */
  rate: number
  /** The provider's fee, in the sending currency. */
  fee: number
  /**
   * How the provider itself applies that fee. Used only to check our parse
   * against the provider's own quoted receive amount — the canonical
   * `amountReceived` we store is always computed in the `deducted` model so
   * that every row answers the same question: "I have X to spend, what lands?"
   */
  feeModel: FeeModel
  /** The provider's own quoted receive amount, when it gives one. Parse check. */
  providerQuotedReceive: number | null

  deliverySpeedText: string
  deliverySpeedMinutes: number | null

  promo: boolean
  promoNote: string | null

  source: QuoteSource
  /** Where the adapter runs. Browser adapters are skipped on Vercel. */
  capturedAt: Date
}

/** Thrown by adapters on an unusable response, so refresh() can fall back. */
export class AdapterError extends Error {
  constructor(
    readonly providerSlug: string,
    message: string,
    readonly cause?: unknown,
  ) {
    super(`[${providerSlug}] ${message}`)
    this.name = 'AdapterError'
  }
}

export interface ProviderAdapter {
  slug: string
  name: string
  /**
   * `http` adapters use plain fetch and run anywhere, including Vercel functions.
   * `browser` adapters need Playwright and only ever run in the GitHub Actions
   * job — the cron route skips them rather than crashing on a missing Chromium.
   */
  runtime: 'http' | 'browser'
  source: QuoteSource
  /** Which corridors and delivery methods this adapter can actually answer for. */
  supports(request: QuoteRequest): boolean
  getQuote(request: QuoteRequest): Promise<Quote>
}

/**
 * Fetch with a hard timeout and a browser-ish UA.
 *
 * Several of these endpoints are the site's own XHR API and reject requests
 * that do not look like they came from the site — Remitly returns NOT_ALLOWED
 * without an `origin` header. Callers pass those in `headers`.
 */
export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number; providerSlug: string },
): Promise<T> {
  const { timeoutMs = 12_000, providerSlug, ...rest } = init
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'accept-language': 'en-GB,en;q=0.9',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        ...rest.headers,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new AdapterError(
        providerSlug,
        `HTTP ${response.status} from ${new URL(url).host}: ${body.slice(0, 200)}`,
      )
    }

    return (await response.json()) as T
  } catch (error) {
    if (error instanceof AdapterError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AdapterError(providerSlug, `timed out after ${timeoutMs}ms`, error)
    }
    throw new AdapterError(providerSlug, 'request failed', error)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Politeness delay between requests to the same host. Adapters are called in
 * sequence per provider by refresh(), so this throttles our footprint without
 * needing a shared rate limiter.
 */
export function jitteredDelay(baseMs = 400, spreadMs = 600): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, baseMs + Math.random() * spreadMs))
}
