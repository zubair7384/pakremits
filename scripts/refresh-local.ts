/**
 * Run a full refresh locally, without going through the HTTP route.
 *
 * Useful for the first populate after seeding, and for debugging the loop with
 * a debugger attached. The cron route is a thin wrapper around the same calls.
 *
 *   npm run refresh
 */
import 'dotenv/config'
import { CORRIDORS } from '../lib/corridors'
import { db } from '../lib/db'
import { midMarketRates } from '../lib/db/schema'
import { getMidMarketRate } from '../lib/fx'
import { pruneOldQuotes, refreshAllRates } from '../lib/providers/refresh'

async function main() {
  console.log('Refreshing mid-market rates…')
  for (const corridor of CORRIDORS) {
    try {
      const rate = await getMidMarketRate(corridor.fromCurrency)
      await db.insert(midMarketRates).values({
        fromCurrency: rate.fromCurrency,
        toCurrency: 'PKR',
        rate: String(rate.rate),
        capturedAt: rate.capturedAt,
        source: rate.source,
      })
      console.log(`  ${corridor.fromCurrency} → PKR  ${rate.rate}  (${rate.source})`)
    } catch (error) {
      console.warn(`  ${corridor.fromCurrency}: ${error instanceof Error ? error.message : error}`)
    }
  }

  console.log('\nRefreshing provider quotes… (this walks the full grid, give it a minute)')
  const result = await refreshAllRates()

  console.log(`\n  written:  ${result.quotesWritten}`)
  console.log(`  ok:       ${result.adaptersOk}`)
  console.log(`  failed:   ${result.adaptersFailed}`)
  console.log(`  stale:    ${result.staleServed}`)
  console.log(`  duration: ${(result.durationMs / 1000).toFixed(1)}s`)

  if (result.failures.length > 0) {
    console.log('\n  Failures:')
    for (const f of result.failures.slice(0, 20)) {
      console.log(`    ${f.provider} ${f.corridor}/${f.method}: ${f.error}`)
    }
    if (result.failures.length > 20) {
      console.log(`    …and ${result.failures.length - 20} more`)
    }
  }

  const pruned = await pruneOldQuotes()
  if (pruned > 0) console.log(`\n  pruned ${pruned} quotes older than 45 days`)

  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
