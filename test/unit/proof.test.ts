import { describe, expect, it } from 'vitest'
import {
  formatPkrWords,
  formatProofPkr,
  formatProofPkrFull,
  groupPkr,
} from '@/lib/proof/format'
import { claimMap, evaluateClaims } from '@/lib/proof/claims'
import { THRESHOLDS } from '@/lib/proof/config'
import type { ProofStats } from '@/lib/proof/stats'

const stats = (overrides: Partial<ProofStats> = {}): ProofStats => ({
  savingsSinceLaunch: 0,
  savingsThisMonth: 0,
  comparisonsThisMonth: 0,
  bestProviderChangesThisMonth: 0,
  providersCompared: 2,
  refreshMinutes: 15,
  computedAt: new Date('2026-09-02T00:00:00Z'),
  ...overrides,
})

describe('groupPkr', () => {
  it('groups the last three digits, then pairs', () => {
    expect(groupPkr(12_000_000)).toBe('1,20,00,000')
    expect(groupPkr(2_500_000)).toBe('25,00,000')
    expect(groupPkr(100_000)).toBe('1,00,000')
  })

  it('leaves short numbers alone', () => {
    expect(groupPkr(0)).toBe('0')
    expect(groupPkr(999)).toBe('999')
    expect(groupPkr(1_000)).toBe('1,000')
    expect(groupPkr(99_999)).toBe('99,999')
  })

  it('does not use Western grouping, which en-PK would have given', () => {
    // The bug this guards: `(12000000).toLocaleString('en-PK')` returns
    // "12,000,000". Only en-IN groups correctly, and naming an Indian locale on
    // a Pakistani site is why this is hand-rolled.
    expect(groupPkr(12_000_000)).not.toBe('12,000,000')
  })

  it('handles negatives, for a corridor where the bank is ahead', () => {
    expect(groupPkr(-2_500_000)).toBe('-25,00,000')
  })

  it('rounds rather than truncating', () => {
    expect(groupPkr(1_234.6)).toBe('1,235')
  })
})

describe('formatPkrWords', () => {
  it('uses crore and lakh where they apply', () => {
    expect(formatPkrWords(12_000_000)).toBe('1.2 crore')
    expect(formatPkrWords(850_000)).toBe('8.5 lakh')
    expect(formatPkrWords(2_500_000)).toBe('25 lakh')
  })

  it('drops a trailing .0', () => {
    expect(formatPkrWords(10_000_000)).toBe('1 crore')
    expect(formatPkrWords(300_000)).toBe('3 lakh')
  })

  it('falls back to digits below one lakh, where no unit helps', () => {
    expect(formatPkrWords(4_200)).toBe('4,200')
  })
})

describe('formatProofPkr', () => {
  it('carries the rupee symbol', () => {
    expect(formatProofPkr(12_000_000)).toBe('₨ 1,20,00,000')
  })

  it('adds the spoken form only when it says something new', () => {
    expect(formatProofPkrFull(12_000_000)).toBe('₨ 1,20,00,000 (1.2 crore)')
    expect(formatProofPkrFull(4_200)).toBe('₨ 4,200')
  })
})

describe('evaluateClaims', () => {
  it('shows the day-one claims with no traffic at all', () => {
    const claims = claimMap(evaluateClaims({ stats: stats(), liveGapOnStandardAmount: 1_500 }))

    expect(claims.pakistanOnly).toBe(true)
    expect(claims.rankedByRupees).toBe(true)
    expect(claims.providersRefreshed).toBe(true)
    expect(claims.liveGap).toBe(true)
  })

  it('hides both threshold claims on a fresh deploy', () => {
    const claims = claimMap(evaluateClaims({ stats: stats(), liveGapOnStandardAmount: 1_500 }))

    expect(claims.monthlyActivity).toBe(false)
    expect(claims.savingsSinceLaunch).toBe(false)
  })

  it('holds the monthly claim back until exactly the threshold', () => {
    const below = claimMap(
      evaluateClaims({
        stats: stats({ comparisonsThisMonth: THRESHOLDS.comparisonsThisMonth - 1 }),
        liveGapOnStandardAmount: null,
      }),
    )
    const at = claimMap(
      evaluateClaims({
        stats: stats({ comparisonsThisMonth: THRESHOLDS.comparisonsThisMonth }),
        liveGapOnStandardAmount: null,
      }),
    )

    expect(below.monthlyActivity).toBe(false)
    expect(at.monthlyActivity).toBe(true)
  })

  it('holds the savings claim back until 25 lakh', () => {
    const below = claimMap(
      evaluateClaims({
        stats: stats({ savingsSinceLaunch: THRESHOLDS.savingsSinceLaunch - 1 }),
        liveGapOnStandardAmount: null,
      }),
    )
    const at = claimMap(
      evaluateClaims({
        stats: stats({ savingsSinceLaunch: THRESHOLDS.savingsSinceLaunch }),
        liveGapOnStandardAmount: null,
      }),
    )

    expect(below.savingsSinceLaunch).toBe(false)
    expect(at.savingsSinceLaunch).toBe(true)
  })

  it('hides the live gap when the corridor has no benchmark', () => {
    const claims = claimMap(evaluateClaims({ stats: stats(), liveGapOnStandardAmount: null }))
    expect(claims.liveGap).toBe(false)
  })

  it('hides the live gap when the best provider is behind the bank', () => {
    // Claiming "₨ -300 more than a typical bank" would be absurd, and claiming
    // a saving of zero would be a lie by rounding.
    expect(
      claimMap(evaluateClaims({ stats: stats(), liveGapOnStandardAmount: -300 })).liveGap,
    ).toBe(false)
    expect(
      claimMap(evaluateClaims({ stats: stats(), liveGapOnStandardAmount: 0 })).liveGap,
    ).toBe(false)
  })

  it('hides every measured claim when the database is unreachable', () => {
    // An outage must not silently publish "0 providers compared" or a stale
    // total. Only the two claims that are statements of policy survive.
    const claims = claimMap(
      evaluateClaims({
        stats: stats({
          unavailable: true,
          providersCompared: 0,
          savingsSinceLaunch: 99_000_000,
          comparisonsThisMonth: 50_000,
        }),
        liveGapOnStandardAmount: null,
      }),
    )

    expect(claims.providersRefreshed).toBe(false)
    expect(claims.monthlyActivity).toBe(false)
    expect(claims.savingsSinceLaunch).toBe(false)
    expect(claims.pakistanOnly).toBe(true)
    expect(claims.rankedByRupees).toBe(true)
  })

  it('keeps the "first in Pakistan" claim off by default', () => {
    // If this ever fails, someone enabled an unsubstantiated superlative.
    const claims = claimMap(evaluateClaims({ stats: stats(), liveGapOnStandardAmount: null }))
    expect(claims.firstPakistanOnlySite).toBe(false)
  })

  it('explains every claim, shown or hidden, for the admin panel', () => {
    const states = evaluateClaims({ stats: stats(), liveGapOnStandardAmount: null })
    expect(states).toHaveLength(7)
    for (const state of states) {
      expect(state.reason.length).toBeGreaterThan(0)
    }
  })
})
