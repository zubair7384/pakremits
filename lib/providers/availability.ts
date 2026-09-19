import type { DeliveryMethod } from '@/lib/db/schema'

/**
 * Verified provider availability that is independent of quote collection.
 *
 * A provider can serve a corridor even when PakRemits cannot currently fetch a
 * live price for it. Keeping those two facts separate prevents the provider
 * pages from labelling a supported route as unavailable, while the comparison
 * table remains limited to genuine rate-and-fee quotes.
 */
export interface ProviderAvailability {
  corridorSlugs: readonly string[]
  methods: readonly DeliveryMethod[]
}

const AVAILABILITY: Readonly<Record<string, ProviderAvailability>> = {
  'enjaz-pay': {
    corridorSlugs: ['saudi-arabia'],
    methods: ['bank', 'cash'],
  },
  telemoney: {
    corridorSlugs: ['saudi-arabia'],
    methods: ['bank', 'cash'],
  },
  'taptap-send': {
    corridorSlugs: ['uk', 'uae', 'usa', 'canada', 'australia', 'eurozone'],
    methods: ['bank', 'wallet', 'cash'],
  },
  xoom: {
    corridorSlugs: ['uk', 'usa', 'canada', 'australia', 'eurozone'],
    methods: ['bank', 'wallet', 'cash'],
  },
  'western-union': {
    corridorSlugs: [
      'uk',
      'uae',
      'saudi-arabia',
      'usa',
      'canada',
      'australia',
      'qatar',
      'eurozone',
    ],
    methods: ['bank', 'wallet', 'cash'],
  },
  moneygram: {
    // MoneyGram publishes online Pakistan corridor pages for these origins.
    // Gulf agent availability is broader, but is not treated as an online
    // sending corridor until MoneyGram confirms it in its consumer flow.
    corridorSlugs: ['uk', 'usa', 'canada', 'australia', 'eurozone'],
    methods: ['bank', 'wallet', 'cash'],
  },
  'al-ansari': {
    corridorSlugs: ['uae'],
    methods: ['bank'],
  },
}

export function providerAvailability(slug: string): ProviderAvailability | null {
  return AVAILABILITY[slug] ?? null
}

export function providerSupportsCorridor(providerSlug: string, corridorSlug: string): boolean {
  return AVAILABILITY[providerSlug]?.corridorSlugs.includes(corridorSlug) ?? false
}
