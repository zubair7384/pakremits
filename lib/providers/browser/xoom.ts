/**
 * Xoom browser adapter.
 *
 * The public calculator exposes a structured first-party guest endpoint after
 * its page establishes the session cookies. GitHub Actions already provides
 * the Playwright runtime used by the Western Union adapter.
 */
import { AdapterError, type ProviderAdapter, type Quote, type QuoteRequest } from '../types'
import { assertCrawlable } from '../robots'

interface MoneyValue {
  rawValue?: string
  currencyCode?: string
}

interface XoomPricing {
  disbursementType?: string
  paymentType?: { type?: string }
  fxRate?: { rate?: string }
  sendAmount?: MoneyValue
  receiveAmount?: MoneyValue
  feeAmount?: MoneyValue
  content?: { key?: string; value?: string }[]
}

export interface XoomRemittance {
  sourceCurrency?: string
  destinationCountry?: string
  destinationCurrency?: string
  quote?: { pricing?: XoomPricing[] }
}

const PAGE_URL = 'https://www.xoom.com/pakistan/send-money?locale=en-us'
const ENDPOINT = 'https://www.xoom.com/wapi/guest-app/remittance'
const SUPPORTED_COUNTRIES = new Set(['GB', 'US', 'CA', 'AU', 'IE'])
const DISBURSEMENT = { bank: 'DEPOSIT', wallet: 'MOBILE_WALLET', cash: 'PICKUP' } as const
const PAYMENT_PRIORITY = [
  'ACH',
  'BANK_ACCOUNT',
  'PAYPAL_BALANCE',
  'DEBIT_CARD',
  'CREDIT_CARD',
  'CRYPTO_PYUSD',
] as const

type Browser = { close(): Promise<void>; newPage(options?: object): Promise<Page> }
type Page = {
  goto(url: string, options?: object): Promise<unknown>
  waitForTimeout(ms: number): Promise<void>
  evaluate<T, A>(fn: (arg: A) => Promise<T>, arg: A): Promise<T>
}

let browserPromise: Promise<Browser> | null = null
let pagePromise: Promise<Page> | null = null
const quotePromises = new Map<string, Promise<XoomRemittance>>()

async function browser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
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
      throw new AdapterError('xoom', 'could not start Chromium', error)
    })
  }
  return browserPromise
}

async function calculatorPage(): Promise<Page> {
  if (!pagePromise) {
    pagePromise = (async () => {
      await assertCrawlable(PAGE_URL)
      const page = await (await browser()).newPage({ locale: 'en-US' })
      await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await page.waitForTimeout(3_000)
      return page
    })().catch((error) => {
      pagePromise = null
      if (error instanceof AdapterError) throw error
      throw new AdapterError('xoom', 'could not initialize the public calculator', error)
    })
  }
  return pagePromise
}

function contentValue(row: XoomPricing, key: string): string | null {
  return row.content?.find((entry) => entry.key === key)?.value ?? null
}

export function parseXoomRemittance(payload: XoomRemittance, request: QuoteRequest): Quote {
  if (
    payload.sourceCurrency !== request.from ||
    payload.destinationCountry !== 'PK' ||
    payload.destinationCurrency !== request.to
  ) {
    throw new AdapterError('xoom', 'calculator returned a different currency corridor')
  }

  const disbursement = DISBURSEMENT[request.method as keyof typeof DISBURSEMENT]
  const candidates = (payload.quote?.pricing ?? []).filter(
    (row) => row.disbursementType === disbursement,
  )
  const selected = candidates.sort((a, b) => {
    const ai = PAYMENT_PRIORITY.indexOf(a.paymentType?.type as never)
    const bi = PAYMENT_PRIORITY.indexOf(b.paymentType?.type as never)
    return (ai === -1 ? Number.POSITIVE_INFINITY : ai) -
      (bi === -1 ? Number.POSITIVE_INFINITY : bi)
  })[0]
  if (!selected) throw new AdapterError('xoom', `no ${request.method} quote in calculator response`)

  const rate = Number(selected.fxRate?.rate)
  const fee = Number(selected.feeAmount?.rawValue)
  const sent = Number(selected.sendAmount?.rawValue)
  const received = Number(selected.receiveAmount?.rawValue)
  if (![rate, fee, sent, received].every(Number.isFinite) || rate <= 0 || fee < 0) {
    throw new AdapterError('xoom', 'calculator returned invalid pricing values')
  }
  if (
    selected.sendAmount?.currencyCode !== request.from ||
    selected.receiveAmount?.currencyCode !== request.to ||
    Math.abs(sent - request.amount) > 0.01 ||
    Math.abs(sent * rate - received) > 1
  ) {
    throw new AdapterError('xoom', 'calculator amounts do not match the requested quote')
  }

  const timing = contentValue(selected, 'feesFx.paymentTypeHeader') ?? 'Timing shown at checkout'
  const promoNote = contentValue(selected, 'feesFx.promoBanner')
  return {
    providerSlug: 'xoom',
    rate,
    fee,
    feeModel: 'additional',
    providerQuotedReceive: received,
    deliverySpeedText: timing.replace(/\.$/, ''),
    deliverySpeedMinutes: /minute/i.test(timing) ? 60 : null,
    promo: Boolean(promoNote),
    promoNote,
    source: 'scrape',
    capturedAt: new Date(),
  }
}

async function loadQuote(request: QuoteRequest): Promise<XoomRemittance> {
  const key = `${request.from}:${request.amount}`
  let promise = quotePromises.get(key)
  if (!promise) {
    promise = (async () => {
      const page = await calculatorPage()
      await assertCrawlable(ENDPOINT)
      const result = await page.evaluate(async ({ endpoint, variables }) => {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify({ variables }),
        })
        return { status: response.status, text: await response.text() }
      }, {
        endpoint: ENDPOINT,
        variables: {
          sourceCurrency: request.from,
          destinationCountry: 'PK',
          destinationCurrency: 'PKR',
          amount: String(request.amount),
          target: 'SEND_AMOUNT',
        },
      })

      if (result.status !== 200) {
        throw new AdapterError('xoom', `calculator returned HTTP ${result.status}`)
      }
      try {
        return JSON.parse(result.text) as XoomRemittance
      } catch (error) {
        throw new AdapterError('xoom', 'calculator returned invalid JSON', error)
      }
    })().catch((error) => {
      quotePromises.delete(key)
      throw error
    })
    quotePromises.set(key, promise)
  }
  return promise
}

export const xoomAdapter: ProviderAdapter = {
  slug: 'xoom',
  name: 'Xoom',
  runtime: 'browser',
  source: 'scrape',

  supports: (request) =>
    request.to === 'PKR' &&
    SUPPORTED_COUNTRIES.has(request.fromCountry) &&
    request.method in DISBURSEMENT,

  async getQuote(request) {
    return parseXoomRemittance(await loadQuote(request), request)
  },

  async dispose() {
    quotePromises.clear()
    pagePromise = null
    const current = browserPromise
    browserPromise = null
    if (current) await (await current).close()
  },
}
