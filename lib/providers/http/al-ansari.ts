/** Al Ansari Exchange's public UAE remittance calculator. */
import { AdapterError, type ProviderAdapter, type Quote, type QuoteRequest } from '../types'
import { assertCrawlable, crawlDelayMs, PAKREMITS_USER_AGENT } from '../robots'
import { throttleHost } from '../throttle'

const PAGE_URL = 'https://alansariexchange.com/send-money-to-pakistan-from-the-uae/'
const AJAX_URL = 'https://alansariexchange.com/wp-admin/admin-ajax.php'

interface AlAnsariResponse {
  amount?: string
  get_rate?: string
  status_msg?: string
}

let noncePromise: Promise<string> | null = null

async function requestIPv4(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; body: string }> {
  const { request } = await import('node:https')
  return new Promise((resolve, reject) => {
    const call = request(
      url,
      {
        family: 4,
        method: options.method ?? 'GET',
        headers: {
          'user-agent': PAKREMITS_USER_AGENT,
          'accept-language': 'en-GB,en;q=0.9',
          ...options.headers,
        },
        timeout: 20_000,
      },
      (response) => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => (body += chunk))
        response.on('end', () => resolve({ status: response.statusCode ?? 0, body }))
      },
    )
    call.on('timeout', () => call.destroy(new Error('request timed out')))
    call.on('error', reject)
    if (options.body) call.write(options.body)
    call.end()
  })
}

async function loadNonce(): Promise<string> {
  await assertCrawlable(PAGE_URL)
  await throttleHost(new URL(PAGE_URL).host, await crawlDelayMs(PAGE_URL))

  const response = await requestIPv4(PAGE_URL, {
    headers: { accept: 'text/html,application/xhtml+xml' },
  })

  if (response.status < 200 || response.status >= 300) {
    throw new AdapterError('al-ansari', `calculator page returned HTTP ${response.status}`)
  }

  const html = response.body
  const nonce = html.match(/CC_Ajax_Object\s*=\s*\{[^}]*"ajax_nonce":"([^"]+)"/)?.[1]
  if (!nonce) throw new AdapterError('al-ansari', 'calculator nonce was not present')
  return nonce
}

function calculatorNonce(): Promise<string> {
  noncePromise ??= loadNonce().catch((error) => {
    noncePromise = null
    throw error
  })
  return noncePromise
}

export function parseAlAnsariRate(payload: AlAnsariResponse, request: QuoteRequest): Quote {
  if (payload.status_msg !== 'SUCCESS') {
    throw new AdapterError('al-ansari', `calculator refused: ${payload.status_msg ?? 'unknown'}`)
  }

  const rate = Number.parseFloat(payload.get_rate ?? '')
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new AdapterError('al-ansari', `bad rate: ${payload.get_rate ?? 'missing'}`)
  }
  return {
    providerSlug: 'al-ansari',
    rate,
    // The public Pakistan page says bank transfers above AED 740 carry no
    // customer charge. Smaller transfers may be charged in a branch, but the
    // calculator exposes no fee field, so we do not invent one.
    fee: 0,
    feeModel: 'additional',
    providerQuotedReceive: request.amount * rate,
    deliverySpeedText: 'Timing shown at checkout',
    deliverySpeedMinutes: null,
    promo: false,
    promoNote: null,
    source: 'scrape',
    capturedAt: new Date(),
  }
}

export const alAnsariAdapter: ProviderAdapter = {
  slug: 'al-ansari',
  name: 'Al Ansari Exchange',
  runtime: 'http',
  source: 'scrape',

  supports: (request) =>
    request.from === 'AED' &&
    request.fromCountry === 'AE' &&
    request.to === 'PKR' &&
    request.method === 'bank' &&
    // Al Ansari only publishes an explicit zero-charge promise above AED 740.
    // Exclude the AED 500 slot rather than silently presenting an unknown fee.
    request.amount >= 740,

  async getQuote(request) {
    const nonce = await calculatorNonce()
    const body = new URLSearchParams({
      action: 'convert_action',
      currfrom: '91', // AED, as used by the official calculator
      currto: '27', // PKR
      cntcode: '27', // Pakistan
      amt: String(request.amount),
      security: nonce,
      trtype: 'BT',
    })

    await assertCrawlable(AJAX_URL)
    await throttleHost(new URL(AJAX_URL).host, await crawlDelayMs(AJAX_URL))
    const response = await requestIPv4(AJAX_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: 'https://alansariexchange.com',
        referer: PAGE_URL,
        'x-requested-with': 'XMLHttpRequest',
      },
      body: body.toString(),
    })

    if (response.status < 200 || response.status >= 300) {
      throw new AdapterError('al-ansari', `calculator returned HTTP ${response.status}`)
    }

    let payload: AlAnsariResponse
    try {
      payload = JSON.parse(response.body) as AlAnsariResponse
    } catch (error) {
      throw new AdapterError('al-ansari', 'calculator returned invalid JSON', error)
    }

    return parseAlAnsariRate(payload, request)
  },
}
