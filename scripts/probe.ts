/**
 * Adapter probe — the tool for adding and debugging providers.
 *
 * Calls each adapter live and prints what came back, without touching the
 * database. When a fixture test starts failing, run this to see the current
 * shape before you change the parser.
 *
 *   npm run probe                    # every adapter, GBP → PKR, bank, 500
 *   npm run probe -- --from AED --amount 3000 --method wallet
 *   npm run probe -- --save          # rewrite test fixtures from live responses
 */
import '../lib/load-env'
import { mkdir, writeFile } from 'node:fs/promises'
import { CORRIDORS, corridorByCurrency } from '../lib/corridors'
import { getMidMarketRate } from '../lib/fx'
import { activeAdapters } from '../lib/providers/registry'
import { canonicalReceived } from '../lib/providers/refresh'
import type { DeliveryMethod, SendCurrency } from '../lib/db/schema'
import type { QuoteRequest } from '../lib/providers/types'

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

async function main() {
  const from = (arg('from', 'GBP') as SendCurrency) ?? 'GBP'
  const method = (arg('method', 'bank') as DeliveryMethod) ?? 'bank'
  const amount = Number(arg('amount', '500'))
  const save = process.argv.includes('--save')

  const corridor = corridorByCurrency(from)
  if (!corridor) {
    console.error(`Unknown currency "${from}". Known: ${CORRIDORS.map((c) => c.fromCurrency).join(', ')}`)
    process.exit(1)
  }

  const request: QuoteRequest = {
    from,
    fromCountry: corridor.fromCountry,
    fromCountry3: corridor.fromCountry3,
    to: 'PKR',
    amount,
    method,
  }

  console.log(`\nProbing ${from} → PKR, ${method}, ${amount} ${from}\n`)

  const mid = await getMidMarketRate(from).catch((e) => {
    console.warn(`  mid-market unavailable: ${e.message}`)
    return null
  })
  if (mid) console.log(`  mid-market: ${mid.rate} (${mid.source})\n`)

  const adapters = activeAdapters()
  const rows: { provider: string; rate: string; fee: string; received: string; note: string }[] = []

  for (const adapter of adapters) {
    if (!adapter.supports(request)) {
      rows.push({
        provider: adapter.name,
        rate: '—',
        fee: '—',
        received: '—',
        note: `does not support ${method}`,
      })
      continue
    }

    try {
      const started = Date.now()
      const quote = await adapter.getQuote(request)
      const received = canonicalReceived(amount, quote)

      rows.push({
        provider: adapter.name,
        rate: quote.rate.toFixed(4),
        fee: quote.fee.toFixed(2),
        received: `₨ ${received.toLocaleString('en-PK')}`,
        note: [
          `${Date.now() - started}ms`,
          quote.deliverySpeedText,
          quote.promo ? `promo: ${quote.promoNote}` : '',
          mid ? `markup ${(((mid.rate - quote.rate) / mid.rate) * 100).toFixed(2)}%` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      })
    } catch (error) {
      rows.push({
        provider: adapter.name,
        rate: '—',
        fee: '—',
        received: 'FAILED',
        note: error instanceof Error ? error.message : String(error),
      })
    }
  }

  console.table(rows)

  if (save) {
    // Re-capture raw responses as test fixtures. Only the two adapters with
    // committed fixtures are handled; extend as adapters are added.
    await mkdir('test/fixtures', { recursive: true })

    const wiseUrl =
      `https://wise.com/gateway/v1/price?sourceAmount=${amount}&sourceCurrency=${from}` +
      `&targetCurrency=PKR&profileCountry=${corridor.fromCountry}&profileType=PERSONAL`
    const remitlyUrl =
      `https://api.remitly.io/v3/calculator/estimate?conduit=${corridor.fromCountry3}:${from}-PAK:PKR` +
      `&anchor=SEND&amount=${amount}&purpose=OTHER&customer_segment=UNRECOGNIZED&strict_promo=false`

    for (const [slug, url, headers] of [
      ['wise', wiseUrl, {}],
      ['remitly', remitlyUrl, { origin: 'https://www.remitly.com', referer: 'https://www.remitly.com/' }],
    ] as const) {
      const body = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0', ...headers },
      }).then((r) => r.text())

      const path = `test/fixtures/${slug}-${from.toLowerCase()}-pkr-${amount}.json`
      await writeFile(path, body)
      console.log(`  saved ${path}`)
    }
  }

  console.log()
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
