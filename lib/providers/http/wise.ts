/**
 * Wise adapter.
 *
 * Endpoint: `https://wise.com/gateway/v1/price` — the same pricing API that
 * powers wise.com's own comparison table. It needs no authentication, which
 * makes it the one genuinely public quote source in the set.
 *
 * Note on the "official" Wise API: `POST /v3/quotes` (the documented
 * unauthenticated quote) still requires a client-credentials token from a Wise
 * Platform partner account, so it is not usable before partner onboarding. If
 * `WISE_CLIENT_TOKEN` is present we could switch to it for a supported contract;
 * until then the gateway endpoint is the pragmatic choice.
 * @see https://docs.wise.com/guides/product/send-money/quotes/unauthenticated-quote
 *
 * Wise prices fee-first: `midRate` is the true mid-market rate and the whole
 * cost sits in `total`. That is why a Wise row often shows the best rate on the
 * page and still loses to a promo rate elsewhere.
 */
import { computeReceived } from '@/lib/ranking/compute'
import { AdapterError, fetchJson, type ProviderAdapter, type Quote, type QuoteRequest } from '../types'

/** One row of the Wise price matrix: a pay-in × pay-out combination. */
interface WisePriceRow {
  sourceAmount: number
  targetAmount: number
  convertedAmount: number
  payInMethod: string
  payOutMethod: string
  sourceCcy: string
  targetCcy: string
  /** All-in fee for this combination, in the sending currency. */
  total: number
  variableFee: number
  flatFee: number
  midRate: number
}

/**
 * We compare the standard consumer path: pay by local bank transfer, receive
 * into a Pakistani bank account. Card pay-in costs 2–4% more and would flatter
 * or punish Wise unfairly against providers we quote on their standard path.
 */
const PAY_IN = 'BANK_TRANSFER'
const PAY_OUT = 'BANK_TRANSFER'

/**
 * Wise's published delivery estimate for PKR bank deposits. The price endpoint
 * carries no ETA field, so this is their stated SLA rather than live data —
 * shown as text, and used only as a tiebreak in the "Fastest" sort.
 * TODO: switch to the `estimatedDeliveryDate` on /v3/quotes once partner
 * credentials exist, and drop this constant.
 */
const DELIVERY = { text: 'In hours', minutes: 240 } as const

export function parseWisePrice(rows: WisePriceRow[], request: QuoteRequest): Quote {
  const row = rows.find((r) => r.payInMethod === PAY_IN && r.payOutMethod === PAY_OUT)

  if (!row) {
    throw new AdapterError(
      'wise',
      `no ${PAY_IN}→${PAY_OUT} row in ${rows.length} priced combinations`,
    )
  }
  if (row.targetCcy !== 'PKR' || row.sourceCcy !== request.from) {
    throw new AdapterError('wise', `currency mismatch: got ${row.sourceCcy}→${row.targetCcy}`)
  }
  if (!Number.isFinite(row.midRate) || row.midRate <= 0) {
    throw new AdapterError('wise', `bad rate: ${row.midRate}`)
  }

  return {
    providerSlug: 'wise',
    // Wise applies no FX markup on this route, so the mid rate is the rate you get.
    rate: row.midRate,
    fee: row.total,
    feeModel: 'deducted',
    providerQuotedReceive: row.targetAmount,
    deliverySpeedText: DELIVERY.text,
    deliverySpeedMinutes: DELIVERY.minutes,
    promo: false,
    promoNote: null,
    source: 'api',
    capturedAt: new Date(),
  }
}

export const wiseAdapter: ProviderAdapter = {
  slug: 'wise',
  name: 'Wise',
  runtime: 'http',
  source: 'api',

  // Wise pays out to Pakistani bank accounts only — no wallet, cash, or RDA rails.
  supports: (request) => request.method === 'bank' && request.to === 'PKR',

  async getQuote(request) {
    const url = new URL('https://wise.com/gateway/v1/price')
    url.searchParams.set('sourceAmount', String(request.amount))
    url.searchParams.set('sourceCurrency', request.from)
    url.searchParams.set('targetCurrency', request.to)
    url.searchParams.set('profileCountry', request.fromCountry)
    url.searchParams.set('profileType', 'PERSONAL')

    const rows = await fetchJson<WisePriceRow[]>(url.toString(), { providerSlug: 'wise' })

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new AdapterError('wise', 'empty price matrix')
    }

    const quote = parseWisePrice(rows, request)
    assertParseMatchesProvider(quote, request)
    return quote
  },
}

/**
 * Cross-check our parse against Wise's own quoted receive amount.
 *
 * If Wise changes the shape of `total` (say, splitting out a new fee component)
 * this catches it immediately instead of quietly publishing a wrong number.
 * A 1 PKR tolerance absorbs their rounding.
 */
export function assertParseMatchesProvider(quote: Quote, request: QuoteRequest): void {
  if (quote.providerQuotedReceive === null) return

  const ours = computeReceived(request.amount, quote.rate, quote.fee, quote.feeModel)
  const drift = Math.abs(ours - quote.providerQuotedReceive)

  if (drift > 1) {
    throw new AdapterError(
      quote.providerSlug,
      `parse drift: we computed ${ours} PKR, provider quoted ` +
        `${quote.providerQuotedReceive} PKR (off by ${drift.toFixed(2)})`,
    )
  }
}
