/**
 * The full refresh, as one function.
 *
 * Previously the HTTP route and the `npm run refresh` script each did their own
 * thing, and only the route recorded a `cron_runs` row. Since the GitHub
 * Actions job runs the script — the HTTP route cannot, because a full refresh
 * takes about four minutes against a 60s function limit — nothing in
 * production was ever writing a run record, and the /admin dashboard would
 * have shown "the refresh has not run recently" permanently while the refresh
 * ran perfectly every 15 minutes.
 *
 * One implementation, both callers, one place that records the run.
 */
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { cronRuns, midMarketRates } from '@/lib/db/schema'
import { CORRIDORS } from '@/lib/corridors'
import { getMidMarketRate } from '@/lib/fx'
import { pruneOldQuotes, refreshAllRates } from '@/lib/providers/refresh'
import { evaluateAlerts, pruneUnconfirmedAlerts } from '@/lib/alerts/evaluate'

export interface FullRefreshResult {
  runId: number | null
  midMarket: { written: number; failed: string[] }
  quotes: Awaited<ReturnType<typeof refreshAllRates>>
  prunedQuotes: number
  alerts: Awaited<ReturnType<typeof evaluateAlerts>> | null
  prunedUnconfirmedAlerts: number
  durationMs: number
}

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

/**
 * Run everything: mid-market, provider quotes, pruning, then alerts.
 *
 * `job` distinguishes the scheduled run from a manual trigger in the /admin
 * history, which matters when you are trying to work out whether the schedule
 * is alive or someone was poking it by hand.
 */
export async function runFullRefresh(job = 'refresh-rates'): Promise<FullRefreshResult> {
  const started = Date.now()

  // Recorded up front so a run that dies halfway still leaves evidence it
  // started — an unfinished row is far more diagnostic than a missing one.
  let runId: number | null = null
  try {
    const [run] = await db.insert(cronRuns).values({ job }).returning()
    runId = run?.id ?? null
  } catch (error) {
    console.error('[cron] could not record run start:', error)
  }

  // Mid-market first: if a provider adapter dies mid-run we still have a fresh
  // reference line for the ticker and the corridor charts.
  const midMarket = await refreshMidMarket()
  const quotes = await refreshAllRates()
  const prunedQuotes = await pruneOldQuotes()

  // Alerts last, so they trigger on the rates this run just wrote. A failure
  // here is a warning: losing an alert must not lose the refresh.
  let alerts: FullRefreshResult['alerts'] = null
  let prunedUnconfirmedAlerts = 0
  try {
    alerts = await evaluateAlerts()
    prunedUnconfirmedAlerts = await pruneUnconfirmedAlerts()
  } catch (error) {
    console.error('[cron] alert evaluation failed:', error)
  }

  const durationMs = Date.now() - started

  if (runId !== null) {
    await db
      .update(cronRuns)
      .set({
        finishedAt: new Date(),
        quotesWritten: quotes.quotesWritten,
        adaptersOk: quotes.adaptersOk,
        adaptersFailed: quotes.adaptersFailed,
        error:
          quotes.failures.length > 0 ? JSON.stringify(quotes.failures.slice(0, 20)) : null,
      })
      .where(eq(cronRuns.id, runId))
      .catch((error) => console.error('[cron] could not record run finish:', error))
  }

  return {
    runId,
    midMarket,
    quotes,
    prunedQuotes,
    alerts,
    prunedUnconfirmedAlerts,
    durationMs,
  }
}
