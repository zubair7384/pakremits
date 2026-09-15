/**
 * Careem Pay adapter.
 *
 * Careem's public remittance widget exposes an anonymous `pubweb` rate feed.
 * Pakistan transfers are fulfilled with Lulu Exchange and currently advertise
 * a waived fixed fee plus a new-customer rate.
 */
import { AdapterError, fetchJson, type ProviderAdapter, type Quote, type QuoteRequest } from '../types'

interface CareemRate {
  destinationCountry: string
  destinationCurrency: string
  estimatedTime: string
  fee: number
  feeThresholdAmount: number
  maxAmount: number
  minAmount: number
  rate: number
}

export function parseCareemRates(payload: CareemRate[], request: QuoteRequest): Quote {
  const row = payload.find(
    (candidate) =>
      candidate.destinationCountry === 'PK' && candidate.destinationCurrency === 'PKR',
  )

  if (!row) throw new AdapterError('careem', 'no AED→PKR rate in response')
  if (!Number.isFinite(row.rate) || row.rate <= 0) {
    throw new AdapterError('careem', `bad rate: ${row.rate}`)
  }
  if (request.amount < row.minAmount || request.amount > row.maxAmount) {
    throw new AdapterError(
      'careem',
      `amount ${request.amount} outside ${row.minAmount}–${row.maxAmount} AED limits`,
    )
  }

  const hours = Number.parseFloat(row.estimatedTime.match(/([\d.]+)\s*hour/i)?.[1] ?? '')

  return {
    providerSlug: 'careem',
    rate: row.rate,
    // The public widget currently crosses out the returned fixed fee and shows
    // FREE for Pakistan. Keep the original value in the fixture so a future UI
    // review can detect when that offer changes.
    fee: 0,
    feeModel: 'additional',
    providerQuotedReceive: request.amount * row.rate,
    deliverySpeedText: row.estimatedTime.replace(/^Money should arrive /i, ''),
    deliverySpeedMinutes: Number.isFinite(hours) ? hours * 60 : null,
    promo: true,
    promoNote: 'New-customer rate and fee offer',
    source: 'api',
    capturedAt: new Date(),
  }
}

export const careemAdapter: ProviderAdapter = {
  slug: 'careem',
  name: 'Careem Pay',
  runtime: 'http',
  source: 'api',

  supports: (request) =>
    request.from === 'AED' &&
    request.fromCountry === 'AE' &&
    request.to === 'PKR' &&
    request.method === 'bank',

  async getQuote(request) {
    const payload = await fetchJson<CareemRate[]>(
      'https://platform.careemapis.com/pubweb/api/remittance-widget-rates',
      {
        providerSlug: 'careem',
        // This is the API explicitly built for Careem's anonymous public web
        // widget. Its API host does not publish a readable robots.txt.
        skipRobots: true,
      },
    )

    if (!Array.isArray(payload)) throw new AdapterError('careem', 'rate feed is not an array')
    return parseCareemRates(payload, request)
  },
}
