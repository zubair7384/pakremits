/**
 * BOTIM adapter.
 *
 * This is the anonymous JSON endpoint behind BOTIM's public international
 * transfer calculator. It quotes AED to PKR for each supported payout rail.
 */
import type { DeliveryMethod } from '@/lib/db/schema'
import { AdapterError, fetchJson, type ProviderAdapter, type Quote, type QuoteRequest } from '../types'

interface BotimMoney {
  amount: number
  currency: string
}

interface BotimRateResponse {
  head?: { code?: string; msg?: string }
  body?: {
    exchangeRate?: {
      exchangeRate?: string
      transactionMode?: string
      fromCountryCode?: string
      fromCurrencyCode?: string
      toCountryCode?: string
      toCurrencyCode?: string
    }
    feeItemInfo?: {
      serviceFee?: BotimMoney
      receivableFee?: BotimMoney
    }
    supportedTransactionMode?: {
      transactionMode: string
      transactionModeDesc: string
      selected: string
    }[]
    offersInfo?: { content?: string }
  }
}

const TRANSACTION_MODE: Record<Exclude<DeliveryMethod, 'neobank' | 'rda'>, string> = {
  bank: 'BANK_TRANSFER',
  wallet: 'MOBILE_WALLET',
  cash: 'CASH_PICK_UP',
}

export function parseBotimRate(payload: BotimRateResponse, request: QuoteRequest): Quote {
  if (payload.head?.code !== '200') {
    throw new AdapterError('botim', `API refused: ${payload.head?.code ?? 'unknown'} ${payload.head?.msg ?? ''}`)
  }

  const body = payload.body
  const exchange = body?.exchangeRate
  const expectedMode = TRANSACTION_MODE[request.method as keyof typeof TRANSACTION_MODE]
  const supported = body?.supportedTransactionMode?.some(
    (mode) => mode.transactionMode === expectedMode,
  )
  const rate = Number.parseFloat(exchange?.exchangeRate ?? '')
  const fee = Number(body?.feeItemInfo?.serviceFee?.amount)

  if (!expectedMode || !supported) {
    throw new AdapterError('botim', `payout method "${request.method}" is not offered`)
  }
  if (
    exchange?.fromCurrencyCode !== 'AED' ||
    exchange.toCurrencyCode !== 'PKR' ||
    exchange.fromCountryCode !== 'AE' ||
    exchange.toCountryCode !== 'PK'
  ) {
    throw new AdapterError(
      'botim',
      `currency mismatch: got ${exchange?.fromCurrencyCode ?? '?'}→${exchange?.toCurrencyCode ?? '?'}`,
    )
  }
  if (exchange.transactionMode !== expectedMode) {
    throw new AdapterError(
      'botim',
      `payout mismatch: requested ${expectedMode}, got ${exchange.transactionMode ?? 'none'}`,
    )
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new AdapterError('botim', `bad rate: ${exchange.exchangeRate ?? 'missing'}`)
  }
  if (!Number.isFinite(fee) || fee < 0) {
    throw new AdapterError('botim', `bad fee: ${body?.feeItemInfo?.serviceFee?.amount ?? 'missing'}`)
  }

  const offer = body?.offersInfo?.content?.trim() || null

  return {
    providerSlug: 'botim',
    rate,
    fee,
    // BOTIM's calculator treats the entered amount as the transfer principal;
    // any service fee is charged separately.
    feeModel: 'additional',
    providerQuotedReceive: request.amount * rate,
    deliverySpeedText: 'Timing shown in app',
    deliverySpeedMinutes: null,
    promo: fee === 0 && offer !== null,
    promoNote: fee === 0 ? offer : null,
    source: 'api',
    capturedAt: new Date(),
  }
}

export const botimAdapter: ProviderAdapter = {
  slug: 'botim',
  name: 'BOTIM',
  runtime: 'http',
  source: 'api',

  supports: (request) =>
    request.from === 'AED' &&
    request.fromCountry === 'AE' &&
    request.to === 'PKR' &&
    ['bank', 'wallet', 'cash'].includes(request.method),

  async getQuote(request) {
    const transactionMode = TRANSACTION_MODE[request.method as keyof typeof TRANSACTION_MODE]
    const payload = await fetchJson<BotimRateResponse>(
      'https://api.payby.com/cgs/api/remittance/v1/unauth/query-rate',
      {
        method: 'POST',
        providerSlug: 'botim',
        headers: {
          'content-language': 'en',
          'content-type': 'application/json',
          origin: 'https://botim.me',
          platform: '3',
          referer: 'https://botim.me/',
        },
        body: JSON.stringify({
          receivingCountry: 'PK',
          receivingCurrency: 'PKR',
          transactionMode,
        }),
      },
    )

    return parseBotimRate(payload, request)
  },
}
