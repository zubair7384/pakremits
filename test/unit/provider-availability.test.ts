import { describe, expect, it } from 'vitest'
import {
  providerAvailability,
  providerSupportsCorridor,
} from '@/lib/providers/availability'

describe('provider availability', () => {
  it('covers every tracked corridor for Western Union', () => {
    expect(providerAvailability('western-union')?.corridorSlugs).toHaveLength(8)
    expect(providerSupportsCorridor('western-union', 'uae')).toBe(true)
    expect(providerSupportsCorridor('western-union', 'qatar')).toBe(true)
  })

  it('limits MoneyGram to verified online sending corridors', () => {
    expect(providerSupportsCorridor('moneygram', 'uk')).toBe(true)
    expect(providerSupportsCorridor('moneygram', 'eurozone')).toBe(true)
    expect(providerSupportsCorridor('moneygram', 'uae')).toBe(false)
  })

  it('does not infer availability for providers without a verified map', () => {
    expect(providerAvailability('unknown')).toBeNull()
    expect(providerSupportsCorridor('unknown', 'uk')).toBe(false)
  })
})
