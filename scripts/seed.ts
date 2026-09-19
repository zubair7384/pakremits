/**
 * Seed: providers, corridors, and 30 days of mid-market history.
 *
 * Run with `npm run seed`. Idempotent — safe to re-run after adding a provider.
 *
 * The history is fetched live from Wise where possible so a fresh deploy shows
 * real sparklines immediately. If that fetch fails it falls back to a synthetic
 * random walk anchored to the current rate, clearly marked `source: 'synthetic'`
 * so it can be deleted once real history accumulates.
 */
import '../lib/load-env'
import { desc } from 'drizzle-orm'
import { getMidMarketHistory, getMidMarketRate } from '../lib/fx'
import { CORRIDORS, CURRENCY_SYMBOLS } from '../lib/corridors'
import { db } from '../lib/db'
import { type SendCurrency, corridors, midMarketRates, providers } from '../lib/db/schema'
import { refreshBenchmarks } from '../lib/proof/benchmarks'

/**
 * Provider catalogue.
 *
 * `affiliateUrlTemplate` is null until each programme is approved — see the
 * README for which network handles which provider. A null template means the
 * redirect falls back to the homepage with no commission, which is the correct
 * behaviour before approval rather than a broken link.
 */
const PROVIDERS = [
  {
    slug: 'wise',
    name: 'Wise',
    brandColor: '#163300',
    brandTextColor: '#9FE870',
    homepageUrl: 'https://wise.com',
    affiliateNetwork: 'impact' as const,
    commissionNote: 'Fixed bounty per new customer via Impact. Does not affect ranking.',
    supportsBank: true,
    supportsWallet: false,
    supportsNeobank: false,
    supportsCash: false,
    supportsRda: false,
  },
  {
    slug: 'remitly',
    name: 'Remitly',
    brandColor: '#2E3192',
    brandTextColor: '#FFFFFF',
    homepageUrl: 'https://www.remitly.com',
    affiliateNetwork: 'impact' as const,
    commissionNote: 'Fixed bounty per first transfer via Impact. Does not affect ranking.',
    supportsBank: true,
    supportsWallet: true,
    supportsNeobank: false,
    supportsCash: true,
    supportsRda: false,
  },
  {
    slug: 'worldremit',
    name: 'WorldRemit',
    brandColor: '#5A2D82',
    brandTextColor: '#FFFFFF',
    homepageUrl: 'https://www.worldremit.com',
    affiliateNetwork: 'impact' as const,
    commissionNote: null,
    supportsBank: true,
    supportsWallet: true,
    supportsNeobank: false,
    supportsCash: true,
    supportsRda: false,
  },
  {
    slug: 'careem',
    name: 'Careem Pay',
    brandColor: '#D7F8E5',
    brandTextColor: '#005C4B',
    homepageUrl: 'https://www.careem.com/en-AE/pay/send-money-aed-to-pkr-rate',
    affiliateNetwork: 'none' as const,
    commissionNote: null,
    supportsBank: true,
    supportsWallet: false,
    supportsNeobank: false,
    supportsCash: false,
    supportsRda: false,
  },
  {
    slug: 'botim',
    name: 'BOTIM',
    brandColor: '#FFFFFF',
    brandTextColor: '#2046F5',
    homepageUrl: 'https://botim.me/international-transfer/',
    affiliateNetwork: 'none' as const,
    commissionNote: null,
    supportsBank: true,
    supportsWallet: true,
    supportsNeobank: false,
    supportsCash: true,
    supportsRda: false,
  },
  {
    slug: 'ace',
    name: 'ACE Money Transfer',
    brandColor: '#9C1F3C',
    brandTextColor: '#FFFFFF',
    homepageUrl: 'https://acemoneytransfer.com',
    affiliateNetwork: 'direct' as const,
    commissionNote: 'Direct partnership. Does not affect ranking.',
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
    commissionNote: null,
    supportsBank: true,
    supportsWallet: true,
    supportsNeobank: false,
    supportsCash: true,
    supportsRda: false,
  },
  {
    slug: 'western-union',
    name: 'Western Union',
    brandColor: '#142832',
    brandTextColor: '#FFD500',
    homepageUrl: 'https://www.westernunion.com',
    affiliateNetwork: 'none' as const,
    commissionNote: null,
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
    commissionNote: null,
    supportsBank: true,
    supportsWallet: false,
    supportsNeobank: false,
    supportsCash: false,
    supportsRda: false,
  },
  {
    slug: 'sadapay',
    name: 'Sadapay',
    brandColor: '#6C2BD9',
    brandTextColor: '#FFFFFF',
    homepageUrl: 'https://sadapay.pk',
    affiliateNetwork: 'none' as const,
    // Sadapay is a receiving wallet, not a sending service — quotes are entered
    // manually via /admin/quotes rather than fetched by an adapter.
    commissionNote: null,
    supportsBank: false,
    supportsWallet: false,
    supportsNeobank: true,
    supportsCash: false,
    supportsRda: false,
  },
  {
    slug: 'nayapay',
    name: 'Nayapay',
    brandColor: '#00B9AE',
    brandTextColor: '#FFFFFF',
    homepageUrl: 'https://www.nayapay.com',
    affiliateNetwork: 'none' as const,
    commissionNote: null,
    supportsBank: false,
    supportsWallet: false,
    supportsNeobank: true,
    supportsCash: false,
    supportsRda: false,
  },
  {
    slug: 'typical-bank',
    name: 'Bank Transfer',
    brandColor: '#8A8F8C',
    brandTextColor: '#FFFFFF',
    homepageUrl: '',
    affiliateNetwork: 'none' as const,
    commissionNote: null,
    supportsBank: true,
    supportsWallet: false,
    supportsNeobank: false,
    supportsCash: false,
    supportsRda: false,
    isBenchmark: true,
  },
]

async function seedProviders() {
  for (const provider of PROVIDERS) {
    await db
      .insert(providers)
      .values(provider)
      .onConflictDoUpdate({
        target: providers.slug,
        // Deliberately does not overwrite affiliateUrlTemplate or featured —
        // those are set in production and must survive a reseed.
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
  console.log(`✓ ${PROVIDERS.length} providers`)
}

async function seedCorridors() {
  for (const corridor of CORRIDORS) {
    await db
      .insert(corridors)
      .values({
        slug: corridor.slug,
        fromCurrency: corridor.fromCurrency,
        fromCountry: corridor.fromCountry,
        fromCountryName: corridor.fromCountryName,
        toCurrency: 'PKR',
        currencySymbol: CURRENCY_SYMBOLS[corridor.fromCurrency],
      })
      .onConflictDoUpdate({
        target: corridors.slug,
        set: {
          fromCountryName: corridor.fromCountryName,
          currencySymbol: CURRENCY_SYMBOLS[corridor.fromCurrency],
        },
      })
  }
  console.log(`✓ ${CORRIDORS.length} corridors`)
}

/**
 * A deterministic random walk, used only when Wise history is unavailable.
 * Seeded off the currency code so repeat runs produce the same shape rather
 * than a new fake history each time.
 */
function syntheticHistory(anchorRate: number, days: number, seedText: string) {
  let seed = [...seedText].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const next = () => {
    // Mulberry32 — small, deterministic, good enough for a decorative chart.
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const points: { date: Date; rate: number }[] = []
  let rate = anchorRate * 0.97 // start slightly below and drift up to today

  for (let i = days; i > 0; i--) {
    rate *= 1 + (next() - 0.45) * 0.004
    const date = new Date()
    date.setUTCDate(date.getUTCDate() - i)
    date.setUTCHours(12, 0, 0, 0)
    points.push({ date, rate: Number(rate.toFixed(6)) })
  }
  return points
}

async function seedMidMarketHistory(days = 30) {
  let real = 0
  let synthetic = 0

  for (const corridor of CORRIDORS) {
    let points: { date: Date; rate: number }[]
    let source: string

    try {
      points = await getMidMarketHistory(corridor.fromCurrency, days)
      source = 'wise'
      real += 1
    } catch (error) {
      const current = await getMidMarketRate(corridor.fromCurrency).catch(() => null)
      if (!current) {
        console.warn(`  ! ${corridor.fromCurrency}: no rate available, skipping history`)
        continue
      }
      points = syntheticHistory(current.rate, days, corridor.fromCurrency)
      source = 'synthetic'
      synthetic += 1
      console.warn(
        `  ! ${corridor.fromCurrency}: Wise history unavailable ` +
          `(${error instanceof Error ? error.message : error}); wrote synthetic history`,
      )
    }

    if (points.length === 0) continue

    await db.insert(midMarketRates).values(
      points.map((p) => ({
        fromCurrency: corridor.fromCurrency,
        toCurrency: 'PKR',
        rate: String(p.rate),
        capturedAt: p.date,
        source,
      })),
    )
  }

  console.log(`✓ mid-market history: ${real} real, ${synthetic} synthetic`)
}

/**
 * Seed the bank benchmarks from the latest mid-market rate.
 *
 * Without these the comparison table has no benchmark row and the savings
 * ledger records every click with a null saving, so a fresh install would count
 * nothing. The cron regenerates them weekly; this just means the site works on
 * the first run rather than after the first Sunday.
 */
async function seedBankBenchmarks() {
  const rows = await db
    .select({ currency: midMarketRates.fromCurrency, rate: midMarketRates.rate })
    .from(midMarketRates)
    .orderBy(desc(midMarketRates.capturedAt))

  // Newest row wins; the query is already in descending capture order.
  const latest = new Map<SendCurrency, number>()
  for (const row of rows) {
    if (!latest.has(row.currency)) latest.set(row.currency, Number(row.rate))
  }

  const { written } = await refreshBenchmarks(latest)
  console.log(`✓ bank benchmarks: ${written} written`)
}

async function main() {
  console.log('Seeding PakRemits…')
  await seedProviders()
  await seedCorridors()
  await seedMidMarketHistory()
  await seedBankBenchmarks()
  console.log('Done. Run `npm run refresh` to pull the first live quotes.')
  process.exit(0)
}

main().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
