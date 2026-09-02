/**
 * Rate refresh cron.
 *
 * Triggered every 15 minutes by .github/workflows/refresh-rates.yml. It is *not*
 * a Vercel Cron job: the Hobby plan caps cron at once per day and rejects any
 * more frequent expression at deploy time, so the schedule lives in GitHub
 * Actions and only the HTTP endpoint lives here.
 * @see https://vercel.com/docs/cron-jobs/usage-and-pricing
 */
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cronRuns, midMarketRates } from '@/lib/db/schema'
import { CORRIDORS } from '@/lib/corridors'
import { isAuthorisedCronRequest } from '@/lib/cron/auth'
import { getMidMarketRate } from '@/lib/fx'
import { pruneOldQuotes, refreshAllRates } from '@/lib/providers/refresh'
import { evaluateAlerts, pruneUnconfirmedAlerts } from '@/lib/alerts/evaluate'

export const dynamic = 'force-dynamic'
// The full grid takes well over the 10s default. Hobby allows up to 60s.
export const maxDuration = 60

/** Refresh the mid-market line for all eight currencies, in parallel. */
async function refreshMidMarket(): Promise<{ written: number; failed: string[] }> {
  const failed: string[] = []

  const results = await Promise.all(
    CORRIDORS.map(async (corridor) => {
      try {
        const rate = await getMidMarketRate(corridor.fromCurrency)
        await db.insert(midMarketRates).values({
          fromCurrency: rate.fromCurrency,
          toCurrency: 'PKR',
          rate: String(rate.rate),
          capturedAt: rate.capturedAt,
          source: rate.source,
        })
        return true
      } catch (error) {
        failed.push(
          `${corridor.fromCurrency}: ${error instanceof Error ? error.message : String(error)}`,
        )
        return false
      }
    }),
  )

  return { written: results.filter(Boolean).length, failed }
}

export async function GET(request: Request) {
  if (!isAuthorisedCronRequest(request)) {
    // 404 rather than 401: no reason to confirm the route exists to a scanner.
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [run] = await db.insert(cronRuns).values({ job: 'refresh-rates' }).returning()

  try {
    // Mid-market first: if a provider adapter dies mid-run we still have a
    // fresh reference line for the ticker and the corridor charts.
    const fx = await refreshMidMarket()
    const quotes = await refreshAllRates()
    const pruned = await pruneOldQuotes()

    // Alerts are evaluated after quotes are committed, so they trigger on the
    // rates this run just wrote rather than the previous run's. A failure here
    // is a warning, not a run failure — losing an alert must not lose the
    // refresh that preceded it.
    let alerts: Awaited<ReturnType<typeof evaluateAlerts>> | null = null
    let prunedAlerts = 0
    try {
      alerts = await evaluateAlerts()
      prunedAlerts = await pruneUnconfirmedAlerts()
    } catch (error) {
      console.error('[cron] alert evaluation failed:', error)
    }

    await db
      .update(cronRuns)
      .set({
        finishedAt: new Date(),
        quotesWritten: quotes.quotesWritten,
        adaptersOk: quotes.adaptersOk,
        adaptersFailed: quotes.adaptersFailed,
        error: quotes.failures.length > 0 ? JSON.stringify(quotes.failures.slice(0, 20)) : null,
      })
      .where(eq(cronRuns.id, run.id))

    return NextResponse.json({
      ok: true,
      durationMs: quotes.durationMs,
      quotes: {
        written: quotes.quotesWritten,
        adaptersOk: quotes.adaptersOk,
        adaptersFailed: quotes.adaptersFailed,
        staleServed: quotes.staleServed,
        failures: quotes.failures,
      },
      midMarket: fx,
      prunedQuotes: pruned,
      alerts,
      prunedUnconfirmedAlerts: prunedAlerts,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[cron] refresh-rates failed:', error)

    await db
      .update(cronRuns)
      .set({ finishedAt: new Date(), error: message })
      .where(eq(cronRuns.id, run.id))
      .catch(() => {})

    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
