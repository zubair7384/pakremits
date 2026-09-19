/** Ensure providers collected by the scheduled job exist before it refreshes. */
import '../lib/load-env'
import { db } from '../lib/db'
import { providers } from '../lib/db/schema'

const RATE_PROVIDERS = [
  {
    slug: 'western-union',
    name: 'Western Union',
    brandColor: '#142832',
    brandTextColor: '#FFD500',
    homepageUrl: 'https://www.westernunion.com',
    affiliateNetwork: 'none' as const,
    supportsBank: true,
    supportsWallet: true,
    supportsNeobank: false,
    supportsCash: true,
    supportsRda: false,
  },
  {
    slug: 'moneygram',
    name: 'MoneyGram',
    brandColor: '#E61915',
    brandTextColor: '#FFFFFF',
    homepageUrl: 'https://www.moneygram.com',
    affiliateNetwork: 'none' as const,
    supportsBank: true,
    supportsWallet: true,
    supportsNeobank: false,
    supportsCash: true,
    supportsRda: false,
  },
  {
    slug: 'al-ansari',
    name: 'Al Ansari Exchange',
    brandColor: '#075CE5',
    brandTextColor: '#FFFFFF',
    homepageUrl: 'https://alansariexchange.com/send-money-to-pakistan-from-the-uae/',
    affiliateNetwork: 'none' as const,
    supportsBank: true,
    supportsWallet: false,
    supportsNeobank: false,
    supportsCash: false,
    supportsRda: false,
  },
] as const

async function main() {
  for (const provider of RATE_PROVIDERS) {
    await db
      .insert(providers)
      .values(provider)
      .onConflictDoUpdate({
        target: providers.slug,
        set: {
          name: provider.name,
          brandColor: provider.brandColor,
          brandTextColor: provider.brandTextColor,
          homepageUrl: provider.homepageUrl,
          supportsBank: provider.supportsBank,
          supportsWallet: provider.supportsWallet,
          supportsNeobank: provider.supportsNeobank,
          supportsCash: provider.supportsCash,
          supportsRda: provider.supportsRda,
        },
      })
  }
  console.log(`Synced ${RATE_PROVIDERS.length} scheduled-rate providers.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
