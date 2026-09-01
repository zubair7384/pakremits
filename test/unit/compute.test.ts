import { describe, expect, it } from 'vitest'
import {
  computeReceived,
  effectiveCost,
  formatPkr,
  markupPercent,
  round,
  totalOutOfPocket,
} from '@/lib/ranking/compute'

describe('round', () => {
  it('rounds half up', () => {
    expect(round(1.005, 2)).toBe(1.01)
    expect(round(2.675, 2)).toBe(2.68)
    expect(round(0.125, 2)).toBe(0.13)
  })

  it('respects the decimal-place argument', () => {
    expect(round(375.0874, 3)).toBe(375.087)
    expect(round(375.5, 0)).toBe(376)
  })
})

describe('computeReceived', () => {
  it('matches a real Wise GBP→PKR quote', () => {
    // Captured from wise.com/gateway/v1/price, BANK_TRANSFER → BANK_TRANSFER.
    // £500 sent, £3.66 total fee, mid-market 375.087 (Wise adds no markup).
    expect(computeReceived(500, 375.087, 3.66)).toBe(186170.68)
  })

  it('matches a real Remitly GBP→PKR quote with a promotional rate', () => {
    // Captured from api.remitly.io/v3/calculator/estimate: zero fee, promo rate.
    expect(computeReceived(500, 377.12, 0)).toBe(188560)
  })

  it('deducts the fee from the sent amount by default', () => {
    expect(computeReceived(100, 300, 10)).toBe(27000) // (100 - 10) * 300
  })

  it('converts the full amount when the fee is charged on top', () => {
    expect(computeReceived(100, 300, 10, 'additional')).toBe(30000) // 100 * 300
  })

  it('returns zero rather than a negative when the fee swallows the transfer', () => {
    // A negative would sort above a legitimate small transfer in a desc ranking.
    expect(computeReceived(10, 300, 25)).toBe(0)
  })

  it('handles a zero-amount transfer', () => {
    expect(computeReceived(0, 375, 0)).toBe(0)
  })

  it('rejects invalid inputs instead of producing NaN', () => {
    expect(() => computeReceived(-1, 375, 0)).toThrow(RangeError)
    expect(() => computeReceived(500, 0, 0)).toThrow(RangeError)
    expect(() => computeReceived(500, -375, 0)).toThrow(RangeError)
    expect(() => computeReceived(500, 375, -1)).toThrow(RangeError)
    expect(() => computeReceived(Number.NaN, 375, 0)).toThrow(RangeError)
    expect(() => computeReceived(500, Number.POSITIVE_INFINITY, 0)).toThrow(RangeError)
  })

  it('stays exact across the standard amount grid', () => {
    for (const amount of [100, 500, 1000, 2000]) {
      const received = computeReceived(amount, 375.087, 3.66)
      expect(received).toBe(round((amount - 3.66) * 375.087, 2))
      expect(Number.isFinite(received)).toBe(true)
    }
  })
})

describe('totalOutOfPocket', () => {
  it('is just the amount when the fee is deducted', () => {
    expect(totalOutOfPocket(500, 3.66)).toBe(500)
  })

  it('adds the fee when it is charged on top', () => {
    expect(totalOutOfPocket(500, 3.66, 'additional')).toBe(503.66)
  })
})

describe('markupPercent', () => {
  it('is zero when the provider gives the mid-market rate', () => {
    expect(markupPercent(375.087, 375.087)).toBe(0)
  })

  it('is positive when the provider shaves the rate', () => {
    expect(markupPercent(370, 375.087)).toBeCloseTo(1.356, 2)
  })

  it('goes negative for above-mid rates, which the incentive scheme produces', () => {
    expect(markupPercent(377.12, 375.06)).toBeLessThan(0)
  })

  it('rejects a non-positive mid-market rate', () => {
    expect(() => markupPercent(375, 0)).toThrow(RangeError)
  })
})

describe('effectiveCost', () => {
  it('equals the fee when the provider adds no rate markup', () => {
    // Wise: fee-only pricing, so the all-in cost is exactly the fee.
    expect(effectiveCost(500, 375.087, 3.66, 375.087)).toBeCloseTo(3.66, 2)
  })

  it('includes the hidden markup for a provider that shaves the rate', () => {
    // Zero visible fee, but 5 PKR/GBP of markup on 500 GBP.
    const cost = effectiveCost(500, 370.087, 0, 375.087)
    expect(cost).toBeCloseTo(6.67, 1)
    expect(cost).toBeGreaterThan(0)
  })
})

describe('formatPkr', () => {
  it('renders the design’s format', () => {
    expect(formatPkr(178000)).toBe('₨ 178,000')
    expect(formatPkr(9608)).toBe('₨ 9,608')
  })

  it('can show decimals when asked', () => {
    expect(formatPkr(186170.68, { decimals: 2 })).toBe('₨ 186,170.68')
  })
})
