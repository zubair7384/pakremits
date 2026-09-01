/**
 * Remitly adapter.
 *
 * Endpoint: `https://api.remitly.io/v3/calculator/estimate` — the XHR API behind
 * remitly.com's own calculator. Unauthenticated, but it rejects requests that do
 * not look like they came from the site: without an `origin` header it returns
 * `{"error_key":"NOT_ALLOWED"}` with HTTP 200, which is why we check the body
 * shape and not just the status.
 *
 * This is an unofficial endpoint. It is unversioned in practice and can change
 * without notice, so the parser validates aggressively and the fixture test is
 * the early-warning system.
 *
 * Remitly prices rate-first: the fee is usually zero and the margin lives in the
 * rate, often with a promotional first-transfer rate on top.
 */
import {
  AdapterError,
  fetchJson,
  type ProviderAdapter,
  type Quote,
  type QuoteRequest,
} from '../types'
import type { DeliveryMethod } from '@/lib/db/schema'

interface RemitlyEstimate {
  exchange_rate: {
    base_rate: string
    promotional_exchange_rate: string | null
    /** Promo rates only apply up to this send amount. */
    capped_promotional_exchange_rate_amount: string | null
  }
  fee: { total_fee_amount: string; is_flat: boolean }
  pay_in_method: string
  pay_out_method: string
  receive_amount: string
  send_amount: string
  total_charge_amount: string
}

interface RemitlyResponse {
  estimate?: RemitlyEstimate
  pay_out_price_estimates?: { estimates: RemitlyEstimate[] }
  error_key?: string
  message?: string
}

/** Remitly's payout vocabulary → ours. Anything unlisted is unsupported. */
const PAY_OUT_METHODS: Record<string, DeliveryMethod> = {
  BANK_DEPOSIT: 'bank',
  CASH_PICKUP: 'cash',
  DIRECT_TO_PHONE: 'wallet',
  MOBILE_MONEY: 'wallet',
  HOME_DELIVERY: 'cash',
}

/**
 * Published delivery estimates per payout rail. Remitly's estimate payload
 * carries no ETA, so these are their stated "Economy" times.
 * TODO: native review of these against Remitly's UK→PK page each quarter.
 */
const DELIVERY: Record<DeliveryMethod, { text: string; minutes: number } | undefined> = {
  bank: { text: '3–5 days', minutes: 4320 },
  cash: { text: 'Minutes', minutes: 15 },
  wallet: { text: 'Minutes', minutes: 15 },
  neobank: undefined,
  rda: undefined,
}

export function parseRemitlyEstimate(
  payload: RemitlyResponse,
  request: QuoteRequest,
): Quote {
  if (payload.error_key) {
    throw new AdapterError('remitly', `API refused: ${payload.error_key} ${payload.message ?? ''}`)
  }

  // Collect every priced payout option, then pick the one matching the request.
  const candidates = [
    ...(payload.pay_out_price_estimates?.estimates ?? []),
    ...(payload.estimate ? [payload.estimate] : []),
  ]

  if (candidates.length === 0) {
    throw new AdapterError('remitly', 'no estimates in response')
  }

  // Prefer an estimate that names the rail we asked for.
  let match = candidates.find(
    (e) => e.pay_out_method && PAY_OUT_METHODS[e.pay_out_method] === request.method,
  )

  if (!match) {
    // Outside the UK, Remitly answers with a single corridor-level estimate:
    // `pay_out_method` is an empty string and `pay_out_price_estimates` is null.
    // Verified on USD, AED, and EUR — passing an explicit `pay_out_method`
    // query parameter is ignored and returns the same numbers. The rate really
    // is identical across rails there; only the delivery speed differs, which
    // we take from the DELIVERY table below. Which rails get shown at all is
    // gated by `supports()` and the provider's capability flags, so this does
    // not invent a payout option Remitly lacks.
    match = candidates.find((e) => !e.pay_out_method)
  }

  if (!match) {
    const seen = [...new Set(candidates.map((e) => e.pay_out_method).filter(Boolean))].join(', ')
    throw new AdapterError(
      'remitly',
      `no payout option for "${request.method}" (offered: ${seen || 'none'})`,
    )
  }

  const baseRate = Number.parseFloat(match.exchange_rate.base_rate)
  const promoRate = match.exchange_rate.promotional_exchange_rate
    ? Number.parseFloat(match.exchange_rate.promotional_exchange_rate)
    : null
  const fee = Number.parseFloat(match.fee.total_fee_amount)

  if (!Number.isFinite(baseRate) || baseRate <= 0) {
    throw new AdapterError('remitly', `bad base_rate: ${match.exchange_rate.base_rate}`)
  }
  if (!Number.isFinite(fee) || fee < 0) {
    throw new AdapterError('remitly', `bad fee: ${match.fee.total_fee_amount}`)
  }

  // A promo rate only applies below the cap. Above it, the sender gets base.
  const cap = match.exchange_rate.capped_promotional_exchange_rate_amount
    ? Number.parseFloat(match.exchange_rate.capped_promotional_exchange_rate_amount)
    : null
  const promoApplies =
    promoRate !== null && promoRate > baseRate && (cap === null || request.amount <= cap)

  const delivery = DELIVERY[request.method]

  return {
    providerSlug: 'remitly',
    rate: promoApplies ? promoRate : baseRate,
    fee,
    // Remitly charges the fee on top: total_charge_amount = send_amount + fee,
    // and receive_amount = send_amount × rate.
    feeModel: 'additional',
    providerQuotedReceive: Number.parseFloat(match.receive_amount),
    deliverySpeedText: delivery?.text ?? 'Varies',
    deliverySpeedMinutes: delivery?.minutes ?? null,
    promo: promoApplies,
    promoNote: promoApplies ? 'New-customer rate' : null,
    source: 'api',
    capturedAt: new Date(),
  }
}

export const remitlyAdapter: ProviderAdapter = {
  slug: 'remitly',
  name: 'Remitly',
  runtime: 'http',
  source: 'api',

  supports: (request) =>
    request.to === 'PKR' && ['bank', 'cash', 'wallet'].includes(request.method),

  async getQuote(request) {
    const url = new URL('https://api.remitly.io/v3/calculator/estimate')
    url.searchParams.set('conduit', `${request.fromCountry3}:${request.from}-PAK:PKR`)
    url.searchParams.set('anchor', 'SEND')
    url.searchParams.set('amount', String(request.amount))
    url.searchParams.set('purpose', 'OTHER')
    url.searchParams.set('customer_segment', 'UNRECOGNIZED')
    url.searchParams.set('strict_promo', 'false')

    const payload = await fetchJson<RemitlyResponse>(url.toString(), {
      providerSlug: 'remitly',
      // Required. Without these the API answers NOT_ALLOWED.
      headers: {
        origin: 'https://www.remitly.com',
        referer: 'https://www.remitly.com/',
      },
    })

    return parseRemitlyEstimate(payload, request)
  },
}
