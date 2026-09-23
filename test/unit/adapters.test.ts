/**
 * Parser tests against real captured responses.
 *
 * These fixtures were pulled live from each provider on 2 Sep 2026. They exist
 * so that a change in an unofficial endpoint's shape fails here, loudly, rather
 * than silently publishing a wrong rupee figure. When a test starts failing,
 * re-capture the fixture with `npm run probe` and read the diff before touching
 * the parser.
 */
import { describe, expect, it } from 'vitest'
import remitlyFixture from '../fixtures/remitly-gbp-pkr-500.json'
import remitlyUsdFixture from '../fixtures/remitly-usd-pkr-1000.json'
import wiseFixture from '../fixtures/wise-gbp-pkr-500.json'
import botimFixture from '../fixtures/botim-aed-pkr.json'
import careemFixture from '../fixtures/careem-aed-pkr.json'
import alAnsariFixture from '../fixtures/al-ansari-aed-pkr.json'
import westernUnionFixture from '../fixtures/western-union-gbp-pkr-500.json'
import xoomFixture from '../fixtures/xoom-usd-pkr-200.json'
import { parseAlAnsariRate, alAnsariAdapter } from '@/lib/providers/http/al-ansari'
import {
  parseWesternUnionCatalog,
  westernUnionAdapter,
} from '@/lib/providers/browser/western-union'
import { parseBotimRate, botimAdapter } from '@/lib/providers/http/botim'
import { parseCareemRates, careemAdapter } from '@/lib/providers/http/careem'
import { parseRemitlyEstimate, remitlyAdapter } from '@/lib/providers/http/remitly'
import { assertParseMatchesProvider, parseWisePrice, wiseAdapter } from '@/lib/providers/http/wise'
import { parseXoomRemittance, xoomAdapter } from '@/lib/providers/browser/xoom'
import { canonicalReceived } from '@/lib/providers/refresh'
import type { QuoteRequest } from '@/lib/providers/types'

const gbpRequest: QuoteRequest = {
  from: 'GBP',
  fromCountry: 'GB',
  fromCountry3: 'GBR',
  to: 'PKR',
  amount: 500,
  method: 'bank',
}

const aedRequest: QuoteRequest = {
  from: 'AED',
  fromCountry: 'AE',
  fromCountry3: 'ARE',
  to: 'PKR',
  amount: 1000,
  method: 'bank',
}

describe('Wise parser', () => {
  it('picks the bank-transfer → bank-transfer row from the price matrix', () => {
    const quote = parseWisePrice(wiseFixture as never, gbpRequest)

    expect(quote.providerSlug).toBe('wise')
    expect(quote.rate).toBe(375.087)
    expect(quote.fee).toBe(3.66)
    expect(quote.feeModel).toBe('deducted')
    expect(quote.source).toBe('api')
    expect(quote.promo).toBe(false)
  })

  it('agrees with the receive amount Wise itself quoted', () => {
    const quote = parseWisePrice(wiseFixture as never, gbpRequest)
    expect(quote.providerQuotedReceive).toBe(186170.68)
    expect(() => assertParseMatchesProvider(quote, gbpRequest)).not.toThrow()
    expect(canonicalReceived(500, quote)).toBe(186170.68)
  })

  it('rejects a matrix with no bank-to-bank combination', () => {
    const cardOnly = (wiseFixture as never as { payInMethod: string }[]).filter(
      (r) => r.payInMethod !== 'BANK_TRANSFER',
    )
    expect(() => parseWisePrice(cardOnly as never, gbpRequest)).toThrow(/no BANK_TRANSFER/)
  })

  it('rejects a currency mismatch', () => {
    const wrong = [{ ...(wiseFixture as never as Record<string, unknown>[])[0] }]
    const bankRow = (wiseFixture as never as Record<string, unknown>[]).find(
      (r) => r.payInMethod === 'BANK_TRANSFER' && r.payOutMethod === 'BANK_TRANSFER',
    )
    wrong[0] = { ...bankRow, targetCcy: 'INR' }
    expect(() => parseWisePrice(wrong as never, gbpRequest)).toThrow(/currency mismatch/)
  })

  it('catches parse drift when the provider’s own number disagrees', () => {
    const quote = parseWisePrice(wiseFixture as never, gbpRequest)
    // Simulate Wise splitting out a new fee component we failed to add up.
    const drifted = { ...quote, fee: 0 }
    expect(() => assertParseMatchesProvider(drifted, gbpRequest)).toThrow(/parse drift/)
  })

  it('only claims support for bank delivery', () => {
    expect(wiseAdapter.supports(gbpRequest)).toBe(true)
    expect(wiseAdapter.supports({ ...gbpRequest, method: 'cash' })).toBe(false)
    expect(wiseAdapter.supports({ ...gbpRequest, method: 'wallet' })).toBe(false)
  })
})

describe('Remitly parser', () => {
  it('reads the promotional rate and zero fee from a live estimate', () => {
    const quote = parseRemitlyEstimate(remitlyFixture as never, gbpRequest)

    expect(quote.providerSlug).toBe('remitly')
    expect(quote.rate).toBe(377.12) // promo rate, above the 375.06 base
    expect(quote.fee).toBe(0)
    expect(quote.feeModel).toBe('additional')
    expect(quote.promo).toBe(true)
    expect(quote.promoNote).toBe('New-customer rate')
  })

  it('maps DIRECT_TO_PHONE to the wallet delivery method', () => {
    const quote = parseRemitlyEstimate(remitlyFixture as never, {
      ...gbpRequest,
      method: 'wallet',
    })
    expect(quote.deliverySpeedText).toBe('Minutes')
    expect(quote.rate).toBe(377.12)
  })

  it('falls back to the base rate above the promotional cap', () => {
    // The fixture caps the promo at a 500 send amount.
    const quote = parseRemitlyEstimate(remitlyFixture as never, {
      ...gbpRequest,
      amount: 2000,
    })
    expect(quote.rate).toBe(375.06)
    expect(quote.promo).toBe(false)
    expect(quote.promoNote).toBeNull()
  })

  it('accepts the corridor-level estimate that non-UK corridors return', () => {
    // USD/AED/EUR answer with a single estimate whose pay_out_method is "" and
    // no pay_out_price_estimates breakdown. Verified live: passing an explicit
    // pay_out_method parameter changes nothing.
    const usdRequest: QuoteRequest = {
      from: 'USD',
      fromCountry: 'US',
      fromCountry3: 'USA',
      to: 'PKR',
      amount: 1000,
      method: 'cash',
    }
    const quote = parseRemitlyEstimate(remitlyUsdFixture as never, usdRequest)

    expect(quote.rate).toBe(277.57)
    expect(quote.fee).toBe(0)
    expect(quote.deliverySpeedText).toBe('Minutes')
    expect(canonicalReceived(1000, quote)).toBe(277570)
  })

  it('uses the same corridor-level rate for every rail it supports', () => {
    const base = { from: 'USD', fromCountry: 'US', fromCountry3: 'USA', to: 'PKR', amount: 1000 } as const
    const bank = parseRemitlyEstimate(remitlyUsdFixture as never, { ...base, method: 'bank' })
    const cash = parseRemitlyEstimate(remitlyUsdFixture as never, { ...base, method: 'cash' })

    expect(bank.rate).toBe(cash.rate)
    // Only the delivery estimate differs between rails.
    expect(bank.deliverySpeedText).not.toBe(cash.deliverySpeedText)
  })

  it('surfaces the NOT_ALLOWED body the API returns without an origin header', () => {
    // Captured verbatim: this comes back with HTTP 200, so status checks miss it.
    const refused = [{ error_key: 'NOT_ALLOWED', message: 'We encountered an error' }]
    expect(() => parseRemitlyEstimate(refused[0] as never, gbpRequest)).toThrow(/NOT_ALLOWED/)
  })

  it('reports which payout options exist when the requested one does not', () => {
    expect(() => parseRemitlyEstimate(remitlyFixture as never, { ...gbpRequest, method: 'rda' }))
      .toThrow(/no payout option for "rda"/)
  })

  it('rejects an empty response rather than returning a zero quote', () => {
    expect(() => parseRemitlyEstimate({} as never, gbpRequest)).toThrow(/no estimates/)
  })

  it('does not claim support for RDA or neobank rails', () => {
    expect(remitlyAdapter.supports(gbpRequest)).toBe(true)
    expect(remitlyAdapter.supports({ ...gbpRequest, method: 'rda' })).toBe(false)
    expect(remitlyAdapter.supports({ ...gbpRequest, method: 'neobank' })).toBe(false)
  })
})

describe('BOTIM parser', () => {
  it('reads the public AED to PKR bank quote and fee offer', () => {
    const quote = parseBotimRate(botimFixture as never, aedRequest)

    expect(quote.providerSlug).toBe('botim')
    expect(quote.rate).toBe(75.51223)
    expect(quote.fee).toBe(0)
    expect(quote.promo).toBe(true)
    expect(quote.promoNote).toBe('First two transfers are free!')
    expect(canonicalReceived(1000, quote)).toBe(75512.23)
  })

  it('supports only UAE bank, wallet, and cash transfers', () => {
    expect(botimAdapter.supports(aedRequest)).toBe(true)
    expect(botimAdapter.supports({ ...aedRequest, method: 'wallet' })).toBe(true)
    expect(botimAdapter.supports({ ...aedRequest, method: 'cash' })).toBe(true)
    expect(botimAdapter.supports({ ...aedRequest, method: 'rda' })).toBe(false)
    expect(botimAdapter.supports({ ...aedRequest, from: 'GBP' })).toBe(false)
  })

  it('rejects a response for the wrong payout method', () => {
    expect(() =>
      parseBotimRate(botimFixture as never, { ...aedRequest, method: 'wallet' }),
    ).toThrow(/payout mismatch/)
  })
})

describe('Careem Pay parser', () => {
  it('reads the public Pakistan rate and current fee waiver', () => {
    const quote = parseCareemRates(careemFixture as never, aedRequest)

    expect(quote.providerSlug).toBe('careem')
    expect(quote.rate).toBe(75.72)
    expect(quote.fee).toBe(0)
    expect(quote.deliverySpeedMinutes).toBe(60)
    expect(quote.promo).toBe(true)
    expect(canonicalReceived(1000, quote)).toBe(75720)
  })

  it('supports only UAE bank transfers', () => {
    expect(careemAdapter.supports(aedRequest)).toBe(true)
    expect(careemAdapter.supports({ ...aedRequest, method: 'wallet' })).toBe(false)
    expect(careemAdapter.supports({ ...aedRequest, from: 'GBP' })).toBe(false)
  })

  it('rejects amounts outside the public limits', () => {
    expect(() =>
      parseCareemRates(careemFixture as never, { ...aedRequest, amount: 100000 }),
    ).toThrow(/outside/)
  })
})

describe('Al Ansari Exchange parser', () => {
  it('reads the official AED to PKR bank-transfer rate', () => {
    const quote = parseAlAnsariRate(alAnsariFixture, aedRequest)

    expect(quote.providerSlug).toBe('al-ansari')
    expect(quote.rate).toBe(75.188)
    expect(quote.fee).toBe(0)
    expect(quote.source).toBe('scrape')
  })

  it('only quotes UAE bank transfers covered by the published zero-fee threshold', () => {
    expect(alAnsariAdapter.supports(aedRequest)).toBe(true)
    expect(alAnsariAdapter.supports({ ...aedRequest, amount: 500 })).toBe(false)
    expect(alAnsariAdapter.supports({ ...aedRequest, method: 'cash' })).toBe(false)
  })
})

describe('Western Union parser', () => {
  it('selects the electronic-bank-funded bank payout', () => {
    const quote = parseWesternUnionCatalog(westernUnionFixture as never, gbpRequest)

    expect(quote.providerSlug).toBe('western-union')
    expect(quote.rate).toBe(373.4627419)
    expect(quote.fee).toBe(0)
    expect(quote.providerQuotedReceive).toBe(186731.37)
    expect(quote.deliverySpeedText).toBe('1 day')
  })

  it('maps Pakistan mobile money and cash pickup separately', () => {
    const wallet = parseWesternUnionCatalog(westernUnionFixture as never, {
      ...gbpRequest,
      method: 'wallet',
    })
    const cash = parseWesternUnionCatalog(westernUnionFixture as never, {
      ...gbpRequest,
      method: 'cash',
    })

    expect(wallet.rate).toBe(382.7528598)
    expect(cash.rate).toBe(376.1085675)
  })

  it('claims all configured sender countries, but no unsupported delivery rail', () => {
    expect(westernUnionAdapter.supports(gbpRequest)).toBe(true)
    expect(westernUnionAdapter.supports({ ...gbpRequest, method: 'rda' })).toBe(false)
    expect(westernUnionAdapter.supports({ ...gbpRequest, fromCountry: 'XX' })).toBe(false)
    expect(
      westernUnionAdapter.supports({
        ...gbpRequest,
        from: 'QAR',
        fromCountry: 'QA',
        fromCountry3: 'QAT',
        amount: 1000,
        method: 'cash',
      }),
    ).toBe(false)
  })
})

describe('Xoom parser', () => {
  const usdRequest: QuoteRequest = {
    from: 'USD',
    fromCountry: 'US',
    fromCountry3: 'USA',
    to: 'PKR',
    amount: 200,
    method: 'bank',
  }

  it('selects bank-funded pricing from the public calculator response', () => {
    const quote = parseXoomRemittance(xoomFixture, usdRequest)

    expect(quote.providerSlug).toBe('xoom')
    expect(quote.rate).toBe(268.435)
    expect(quote.fee).toBe(0)
    expect(quote.providerQuotedReceive).toBe(53687)
    expect(quote.source).toBe('scrape')
  })

  it('maps mobile wallet and cash pickup separately', () => {
    const wallet = parseXoomRemittance(xoomFixture, { ...usdRequest, method: 'wallet' })
    const cash = parseXoomRemittance(xoomFixture, { ...usdRequest, method: 'cash' })

    expect(wallet.rate).toBe(266.1213)
    expect(cash.rate).toBe(264.5238)
  })

  it('supports verified origins and available payout rails only', () => {
    expect(xoomAdapter.supports(usdRequest)).toBe(true)
    expect(xoomAdapter.supports({ ...usdRequest, method: 'wallet' })).toBe(true)
    expect(xoomAdapter.supports({ ...usdRequest, method: 'rda' })).toBe(false)
    expect(xoomAdapter.supports({ ...usdRequest, fromCountry: 'AE' })).toBe(false)
  })

  it('rejects mismatched calculator responses', () => {
    expect(() =>
      parseXoomRemittance({ ...xoomFixture, destinationCurrency: 'INR' }, usdRequest),
    ).toThrow(/different currency corridor/)
  })
})

describe('cross-provider comparison', () => {
  it('normalises both fee models onto the same £500 budget', () => {
    const wise = parseWisePrice(wiseFixture as never, gbpRequest)
    const remitly = parseRemitlyEstimate(remitlyFixture as never, gbpRequest)

    const wiseReceived = canonicalReceived(500, wise)
    const remitlyReceived = canonicalReceived(500, remitly)

    // Both answer "I have £500 to spend" — Wise's fee comes out of it, and
    // Remitly's zero fee means the whole £500 converts at the promo rate.
    expect(wiseReceived).toBe(186170.68)
    expect(remitlyReceived).toBe(188560)
    expect(remitlyReceived).toBeGreaterThan(wiseReceived)
  })
})
