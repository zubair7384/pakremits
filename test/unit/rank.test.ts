import { describe, expect, it } from 'vitest'
import { type RankableQuote, rankQuotes, savingVsBenchmark } from '@/lib/ranking/rank'

function quote(partial: Partial<RankableQuote> & { providerSlug: string }): RankableQuote {
  return {
    providerName: partial.providerSlug,
    amountReceived: 100000,
    fee: 0,
    rate: 375,
    deliverySpeedMinutes: 60,
    featured: false,
    isBenchmark: false,
    ...partial,
  }
}

const wise = quote({
  providerSlug: 'wise',
  providerName: 'Wise',
  amountReceived: 186170.68,
  fee: 3.66,
  deliverySpeedMinutes: 120,
})
const remitly = quote({
  providerSlug: 'remitly',
  providerName: 'Remitly',
  amountReceived: 188560,
  fee: 0,
  deliverySpeedMinutes: 4320,
})
const ace = quote({
  providerSlug: 'ace',
  providerName: 'ACE Money Transfer',
  amountReceived: 177750,
  fee: 1.99,
  deliverySpeedMinutes: 480,
})
const bank = quote({
  providerSlug: 'typical-bank',
  providerName: 'Typical high-street bank',
  amountReceived: 168392,
  fee: 15,
  deliverySpeedMinutes: 4320,
  isBenchmark: true,
})

describe('rankQuotes — default "received" sort', () => {
  it('orders by amount received, highest first', () => {
    const ranked = rankQuotes([ace, wise, remitly])
    expect(ranked.map((r) => r.quote.providerSlug)).toEqual(['remitly', 'wise', 'ace'])
  })

  it('flags exactly one best row', () => {
    const ranked = rankQuotes([ace, wise, remitly])
    expect(ranked.filter((r) => r.isBest)).toHaveLength(1)
    expect(ranked.find((r) => r.isBest)?.quote.providerSlug).toBe('remitly')
  })

  it('computes the PKR gap to the best row', () => {
    const ranked = rankQuotes([ace, wise, remitly])
    expect(ranked[0].diffFromBest).toBe(0)
    expect(ranked[1].diffFromBest).toBe(-2389.32) // 186170.68 - 188560
  })

  it('scales the design’s bar against the best row', () => {
    const ranked = rankQuotes([ace, wise, remitly])
    expect(ranked[0].barPercent).toBe(100)
    expect(ranked[1].barPercent).toBeCloseTo(98.73, 1)
  })

  it('breaks ties on speed, then fee, then name', () => {
    const slow = quote({ providerSlug: 'slow', providerName: 'Slow', deliverySpeedMinutes: 999 })
    const fast = quote({ providerSlug: 'fast', providerName: 'Fast', deliverySpeedMinutes: 10 })
    expect(rankQuotes([slow, fast]).map((r) => r.quote.providerSlug)).toEqual(['fast', 'slow'])
  })

  it('is stable regardless of input order', () => {
    const a = rankQuotes([ace, wise, remitly, bank]).map((r) => r.quote.providerSlug)
    const b = rankQuotes([bank, remitly, ace, wise]).map((r) => r.quote.providerSlug)
    expect(a).toEqual(b)
  })

  it('sorts an unknown delivery speed last rather than first', () => {
    const unknown = quote({ providerSlug: 'unknown', deliverySpeedMinutes: null })
    const known = quote({ providerSlug: 'known', deliverySpeedMinutes: 500 })
    expect(rankQuotes([unknown, known]).map((r) => r.quote.providerSlug)).toEqual([
      'known',
      'unknown',
    ])
  })
})

describe('rankQuotes — benchmark handling', () => {
  it('always places the bank benchmark last, even when it is not the worst', () => {
    const worse = quote({ providerSlug: 'worse', amountReceived: 100 })
    const ranked = rankQuotes([bank, worse, wise])
    expect(ranked.at(-1)?.quote.providerSlug).toBe('typical-bank')
  })

  it('never marks the benchmark as best, even if it is alone', () => {
    expect(rankQuotes([bank]).some((r) => r.isBest)).toBe(false)
  })
})

describe('rankQuotes — sponsored placement', () => {
  it('pins a featured provider below the best deal, never above', () => {
    const featured = { ...ace, featured: true }
    const ranked = rankQuotes([featured, wise, remitly])
    expect(ranked.map((r) => r.quote.providerSlug)).toEqual(['remitly', 'ace', 'wise'])
    expect(ranked[0].isBest).toBe(true)
    expect(ranked[0].quote.featured).toBe(false)
  })

  it('leaves a featured provider on top when it won on merit', () => {
    const featured = { ...remitly, featured: true }
    const ranked = rankQuotes([ace, wise, featured])
    expect(ranked[0].quote.providerSlug).toBe('remitly')
    expect(ranked[0].isBest).toBe(true)
  })

  it('never lets sponsorship change which row is best', () => {
    const withoutSponsor = rankQuotes([ace, wise, remitly]).find((r) => r.isBest)
    const withSponsor = rankQuotes([{ ...ace, featured: true }, wise, remitly]).find(
      (r) => r.isBest,
    )
    expect(withSponsor?.quote.providerSlug).toBe(withoutSponsor?.quote.providerSlug)
  })
})

describe('rankQuotes — alternative sorts', () => {
  it('"fastest" reorders rows but keeps the gold highlight on the most rupees', () => {
    const ranked = rankQuotes([ace, wise, remitly], 'fastest')
    expect(ranked[0].quote.providerSlug).toBe('wise') // 120 min
    expect(ranked.find((r) => r.isBest)?.quote.providerSlug).toBe('remitly')
  })

  it('"lowest-fee" sorts by fee ascending', () => {
    const ranked = rankQuotes([ace, wise, remitly], 'lowest-fee')
    expect(ranked.map((r) => r.quote.providerSlug)).toEqual(['remitly', 'ace', 'wise'])
  })
})

describe('savingVsBenchmark', () => {
  it('returns the PKR gap between the best provider and the bank', () => {
    expect(savingVsBenchmark(rankQuotes([ace, wise, remitly, bank]))).toBe(20168)
  })

  it('returns null when the corridor has no bank benchmark', () => {
    expect(savingVsBenchmark(rankQuotes([ace, wise]))).toBeNull()
  })

  it('returns null when there is nothing but a benchmark', () => {
    expect(savingVsBenchmark(rankQuotes([bank]))).toBeNull()
  })
})

describe('rankQuotes — edge cases', () => {
  it('handles an empty list', () => {
    expect(rankQuotes([])).toEqual([])
  })

  it('does not divide by zero when every quote is zero', () => {
    const zero = quote({ providerSlug: 'zero', amountReceived: 0 })
    expect(rankQuotes([zero])[0].barPercent).toBe(0)
  })
})
