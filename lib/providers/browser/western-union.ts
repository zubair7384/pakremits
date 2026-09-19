/**
 * Western Union browser adapter.
 *
 * The public send-money page initializes a first-party session before its
 * anonymous `/wuconnect/prices/catalog` request will answer. GitHub Actions
 * owns the browser runtime; deployed Next.js processes never load Playwright.
 */
import { randomUUID } from 'node:crypto'
import { AdapterError, type ProviderAdapter, type Quote, type QuoteRequest } from '../types'
import { assertCrawlable } from '../robots'

interface PayGroup {
  fund_in?: string
  fx_rate?: number
  send_amount?: number
  receive_amount?: number
  gross_amount?: number
  gross_fee?: number
  min_amount?: number
  max_amount?: number
}

interface ServiceGroup {
  service?: string
  service_name?: string
  fund_out_mnem?: string
  speed_days?: number
  pay_groups?: PayGroup[]
}

export interface WesternUnionCatalog {
  response_status?: { status?: number; code?: string; message?: string }
  sender?: { cty_iso2_ext?: string; curr_iso3?: string; send_amount?: number }
  receiver?: { cty_iso2_ext?: string; curr_iso3?: string }
  services_groups?: ServiceGroup[]
}

const LOCALE_PATH: Record<string, string> = {
  GB: 'gb/en',
  AE: 'ae/en',
  SA: 'sa/en',
  US: 'us/en',
  CA: 'ca/en',
  AU: 'au/en',
  QA: 'qa/en',
  IE: 'ie/en',
}

const PAYOUT_MNEMONIC = { bank: 'DB', wallet: 'MB', cash: 'MM' } as const
const METHODS_BY_COUNTRY: Record<string, readonly QuoteRequest['method'][]> = {
  GB: ['bank', 'wallet', 'cash'],
  AE: ['cash'],
  SA: ['cash'],
  US: ['bank', 'wallet', 'cash'],
  CA: ['bank', 'wallet', 'cash'],
  AU: ['bank', 'wallet', 'cash'],
  // The Qatar send page works from a residential browser but repeatedly times
  // out from GitHub's runner network. Keep its catalogue availability separate
  // and do not create a scheduled slot until WU makes that page reachable.
  QA: [],
  IE: ['bank', 'wallet', 'cash'],
}
const PAYIN_PRIORITY = ['EB', 'TR', 'PA', 'GP', 'AP', 'CC', 'CA'] as const

type Browser = { close(): Promise<void>; newPage(options?: object): Promise<Page> }
type Page = {
  goto(url: string, options?: object): Promise<unknown>
  waitForTimeout(ms: number): Promise<void>
  evaluate<T, A>(fn: (arg: A) => Promise<T>, arg: A): Promise<T>
}

let browserPromise: Promise<Browser> | null = null
const pagePromises = new Map<string, Promise<Page>>()

async function browser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      // Hide this optional dependency from the Next.js server bundle. It is
      // installed in the GitHub Actions refresh job, then loaded only there.
      const dynamicImport = new Function('name', 'return import(name)') as (
        name: string,
      ) => Promise<typeof import('playwright')>
      const { chromium } = await dynamicImport('playwright')
      try {
        return (await chromium.launch({ headless: true })) as Browser
      } catch (error) {
        if (process.platform !== 'win32') throw error
        return (await chromium.launch({ channel: 'msedge', headless: true })) as Browser
      }
    })().catch((error) => {
      browserPromise = null
      throw new AdapterError('western-union', 'could not start Chromium', error)
    })
  }
  return browserPromise
}

async function pageFor(country: string): Promise<Page> {
  const locale = LOCALE_PATH[country]
  if (!locale) throw new AdapterError('western-union', `unsupported sender country ${country}`)

  let promise = pagePromises.get(country)
  if (!promise) {
    const url = `https://www.westernunion.com/${locale}/web/send-money/start`
    promise = (async () => {
      await assertCrawlable(url)
      const page = await (await browser()).newPage({ locale: 'en-GB' })
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      // Session and anti-abuse cookies arrive through the page's startup calls.
      await page.waitForTimeout(7_000)
      return page
    })().catch((error) => {
      pagePromises.delete(country)
      if (error instanceof AdapterError) throw error
      throw new AdapterError('western-union', `could not initialize ${country} pricing page`, error)
    })
    pagePromises.set(country, promise)
  }
  return promise
}

export function parseWesternUnionCatalog(
  payload: WesternUnionCatalog,
  request: QuoteRequest,
): Quote {
  if (![0, 1].includes(payload.response_status?.status ?? -1)) {
    throw new AdapterError(
      'western-union',
      `catalog refused: ${payload.response_status?.code ?? 'unknown'} ${payload.response_status?.message ?? ''}`,
    )
  }
  if (
    payload.sender?.cty_iso2_ext !== request.fromCountry ||
    payload.sender.curr_iso3 !== request.from ||
    payload.receiver?.cty_iso2_ext !== 'PK' ||
    payload.receiver.curr_iso3 !== 'PKR'
  ) {
    throw new AdapterError('western-union', 'catalog returned a different currency corridor')
  }

  const mnemonic = PAYOUT_MNEMONIC[request.method as keyof typeof PAYOUT_MNEMONIC]
  const candidates = (payload.services_groups ?? []).filter(
    (group) => group.fund_out_mnem === mnemonic,
  )

  const priced = candidates
    .flatMap((group) =>
      (group.pay_groups ?? []).map((pay) => ({ group, pay })),
    )
    .filter(({ pay }) =>
      Number.isFinite(pay.fx_rate) &&
      Number.isFinite(pay.gross_fee) &&
      Number.isFinite(pay.receive_amount) &&
      request.amount >= (pay.min_amount ?? 0) &&
      request.amount <= (pay.max_amount ?? Number.POSITIVE_INFINITY),
    )
    .sort((a, b) => {
      const aIndex = PAYIN_PRIORITY.indexOf(a.pay.fund_in as never)
      const bIndex = PAYIN_PRIORITY.indexOf(b.pay.fund_in as never)
      const aPriority = aIndex === -1 ? Number.POSITIVE_INFINITY : aIndex
      const bPriority = bIndex === -1 ? Number.POSITIVE_INFINITY : bIndex
      if (aPriority !== bPriority) return aPriority - bPriority
      return (b.pay.receive_amount ?? 0) - (a.pay.receive_amount ?? 0)
    })

  const selected = priced[0]
  if (!selected) {
    throw new AdapterError('western-union', `no ${request.method} quote in catalog`)
  }

  const rate = selected.pay.fx_rate as number
  const fee = selected.pay.gross_fee as number
  const receive = selected.pay.receive_amount as number
  if (Math.abs(request.amount * rate - receive) > 1) {
    throw new AdapterError('western-union', 'catalog receive amount does not match its rate')
  }

  const days = selected.group.speed_days
  return {
    providerSlug: 'western-union',
    rate,
    fee,
    feeModel: 'additional',
    providerQuotedReceive: receive,
    deliverySpeedText: Number.isFinite(days) ? `${days} day${days === 1 ? '' : 's'}` : 'Timing shown at checkout',
    deliverySpeedMinutes: Number.isFinite(days) ? (days as number) * 24 * 60 : null,
    promo: false,
    promoNote: null,
    source: 'scrape',
    capturedAt: new Date(),
  }
}

export const westernUnionAdapter: ProviderAdapter = {
  slug: 'western-union',
  name: 'Western Union',
  runtime: 'browser',
  source: 'scrape',

  supports: (request) =>
    request.to === 'PKR' &&
    request.fromCountry in LOCALE_PATH &&
    METHODS_BY_COUNTRY[request.fromCountry]?.includes(request.method),

  async getQuote(request) {
    const page = await pageFor(request.fromCountry)
    const endpoint = 'https://www.westernunion.com/wuconnect/prices/catalog'
    await assertCrawlable(endpoint)

    const session = `web-${randomUUID()}`
    const now = Date.now()
    const body = {
      header_request: {
        version: '0.5',
        request_type: 'PRICECATALOG',
        correlation_id: session,
        transaction_id: `${session}-${now}`,
      },
      sender: {
        client: 'WUCOM',
        channel: 'WWEB',
        cty_iso2_ext: request.fromCountry,
        curr_iso3: request.from,
        funds_in: '*',
        send_amount: request.amount,
        air_requested: 'Y',
        efl_type: 'STATE',
        efl_value: request.fromCountry === 'US' ? 'CA' : '',
      },
      receiver: { curr_iso3: 'PKR', cty_iso2_ext: 'PK', cty_iso2: 'PK' },
      visit: { local_datetime: { timestamp_ms: now, timezone: 0 } },
    }

    const result = await page.evaluate(async ({ endpoint, body }) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      return { status: response.status, text: await response.text() }
    }, { endpoint, body })

    if (result.status !== 200) {
      throw new AdapterError('western-union', `catalog returned HTTP ${result.status}`)
    }

    let payload: WesternUnionCatalog
    try {
      payload = JSON.parse(result.text) as WesternUnionCatalog
    } catch (error) {
      throw new AdapterError('western-union', 'catalog returned invalid JSON', error)
    }
    return parseWesternUnionCatalog(payload, request)
  },

  async dispose() {
    pagePromises.clear()
    const current = browserPromise
    browserPromise = null
    if (current) await (await current).close()
  },
}
