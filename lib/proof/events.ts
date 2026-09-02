/**
 * Comparison-run events, and the daily rollup that feeds the admin chart.
 */
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { comparisonEvents } from '@/lib/db/schema'

/** Name of the opaque session cookie. No personal data, no cross-site value. */
export const SESSION_COOKIE = 'prq_sid'

/** How long comparison events are kept before the rollup makes them redundant. */
const EVENT_RETENTION_DAYS = 45

/**
 * Record that the comparison widget fetched quotes, once per session per minute.
 *
 * The dedup is a unique index on (session, minute) with ON CONFLICT DO NOTHING,
 * not a read-then-write. Someone dragging the amount slider fires several
 * requests within the same second; two of them racing would both pass a
 * "have we seen this session this minute?" SELECT and insert twice. Letting
 * Postgres enforce it is the only version that is actually correct under
 * concurrency, and it is one round trip instead of two.
 */
export async function recordComparisonRun(
  sessionId: string,
  corridorId: number | null,
): Promise<void> {
  try {
    const minuteBucket = new Date()
    minuteBucket.setSeconds(0, 0)

    await db
      .insert(comparisonEvents)
      .values({ sessionId, minuteBucket, corridorId })
      .onConflictDoNothing({
        target: [comparisonEvents.sessionId, comparisonEvents.minuteBucket],
      })
  } catch (error) {
    // Analytics must never break a quote response.
    console.error('[proof] recordComparisonRun failed:', error)
  }
}

/**
 * Rebuild `site_stats_daily` for the last `days` days.
 *
 * Idempotent: a full recompute per day rather than an increment, so running it
 * twice — or after a partial cron failure — converges on the same numbers
 * instead of double-counting. `best_provider_changes` is the exception, since
 * it is an event counted at detection time and cannot be recomputed from
 * current state; it is incremented in place and preserved here.
 */
export async function rollUpSiteStats(days = 3): Promise<number> {
  try {
    const result = await db.execute(sql`
      INSERT INTO site_stats_daily (date, comparisons_run, clicks, saving_pkr_total, best_provider_changes)
      SELECT
        d.day::text,
        coalesce(c.n, 0),
        coalesce(k.n, 0),
        coalesce(s.total, 0),
        0
      FROM generate_series(
             (current_date - make_interval(days => ${days}))::date,
             current_date,
             interval '1 day'
           ) AS d(day)
      LEFT JOIN (
        SELECT date_trunc('day', created_at)::date AS day, count(*)::int AS n
        FROM comparison_events GROUP BY 1
      ) c ON c.day = d.day
      LEFT JOIN (
        SELECT date_trunc('day', created_at)::date AS day, count(*)::int AS n
        FROM affiliate_clicks GROUP BY 1
      ) k ON k.day = d.day
      LEFT JOIN (
        SELECT date_trunc('day', created_at)::date AS day, sum(saving_pkr) AS total
        FROM savings_ledger WHERE saving_pkr IS NOT NULL GROUP BY 1
      ) s ON s.day = d.day
      ON CONFLICT (date) DO UPDATE SET
        comparisons_run  = excluded.comparisons_run,
        clicks           = excluded.clicks,
        saving_pkr_total = excluded.saving_pkr_total
    `)

    return Array.isArray(result) ? result.length : days + 1
  } catch (error) {
    console.error('[proof] rollUpSiteStats failed:', error)
    return 0
  }
}

/** Count a change of top-ranked provider against today's row. */
export async function recordBestProviderChange(count = 1): Promise<void> {
  if (count <= 0) return

  try {
    await db.execute(sql`
      INSERT INTO site_stats_daily (date, best_provider_changes)
      VALUES (current_date::text, ${count})
      ON CONFLICT (date) DO UPDATE SET
        best_provider_changes = site_stats_daily.best_provider_changes + ${count}
    `)
  } catch (error) {
    console.error('[proof] recordBestProviderChange failed:', error)
  }
}

/** Drop comparison events the rollup has already absorbed. */
export async function pruneComparisonEvents(days = EVENT_RETENTION_DAYS): Promise<number> {
  try {
    const deleted = await db
      .delete(comparisonEvents)
      .where(sql`${comparisonEvents.createdAt} < now() - make_interval(days => ${days})`)
      .returning({ id: comparisonEvents.id })

    return deleted.length
  } catch (error) {
    console.error('[proof] pruneComparisonEvents failed:', error)
    return 0
  }
}
