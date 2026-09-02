/**
 * Admin dashboard queries.
 *
 * Deliberately raw SQL for the aggregates. These are grouped, date-bucketed
 * counts that the query builder expresses badly, and the dashboard is the one
 * place where reading the actual SQL matters — if the revenue numbers are
 * wrong, you want to see the GROUP BY.
 *
 * Everything here is read-only and every function degrades to an empty result
 * rather than throwing. A dashboard that 500s because one panel failed tells
 * you nothing about the other five.
 */
import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { db, toNum } from '@/lib/db'
import {
  affiliateClicks,
  corridors,
  cronRuns,
  providers,
  rateAlerts,
  rateQuotes,
} from '@/lib/db/schema'

export interface ClicksByDay {
  day: string
  provider: string
  corridor: string | null
  clicks: number
}

/** Clicks grouped by day, provider and corridor — the revenue picture. */
export async function clicksByDay(days = 14): Promise<ClicksByDay[]> {
  try {
    const rows = (await db.execute(sql`
      SELECT
        to_char(date_trunc('day', ${affiliateClicks.createdAt}), 'YYYY-MM-DD') AS day,
        ${providers.name} AS provider,
        ${corridors.fromCountryName} AS corridor,
        count(*)::int AS clicks
      FROM ${affiliateClicks}
      INNER JOIN ${providers} ON ${providers.id} = ${affiliateClicks.providerId}
      LEFT JOIN ${corridors} ON ${corridors.id} = ${affiliateClicks.corridorId}
      WHERE ${affiliateClicks.createdAt} > now() - make_interval(days => ${days})
      GROUP BY 1, 2, 3
      ORDER BY 1 DESC, 4 DESC
    `)) as unknown as ClicksByDay[]

    return rows
  } catch (error) {
    console.error('[admin] clicksByDay failed:', error)
    return []
  }
}

export interface ClickTotals {
  today: number
  last7: number
  last30: number
  allTime: number
}

export async function clickTotals(): Promise<ClickTotals> {
  try {
    const [row] = (await db.execute(sql`
      SELECT
        count(*) FILTER (WHERE ${affiliateClicks.createdAt} >= date_trunc('day', now()))::int AS today,
        count(*) FILTER (WHERE ${affiliateClicks.createdAt} > now() - interval '7 days')::int  AS last7,
        count(*) FILTER (WHERE ${affiliateClicks.createdAt} > now() - interval '30 days')::int AS last30,
        count(*)::int AS "allTime"
      FROM ${affiliateClicks}
    `)) as unknown as ClickTotals[]

    return row ?? { today: 0, last7: 0, last30: 0, allTime: 0 }
  } catch (error) {
    console.error('[admin] clickTotals failed:', error)
    return { today: 0, last7: 0, last30: 0, allTime: 0 }
  }
}

export interface AlertStats {
  total: number
  confirmed: number
  awaitingConfirmation: number
  wantsDigest: number
  byChannel: { channel: string; count: number }[]
  byCurrency: { currency: string; count: number }[]
  recent: { createdAt: Date; channel: string; currency: string; target: number; direction: string; confirmed: boolean }[]
}

export async function alertStats(): Promise<AlertStats> {
  const empty: AlertStats = {
    total: 0,
    confirmed: 0,
    awaitingConfirmation: 0,
    wantsDigest: 0,
    byChannel: [],
    byCurrency: [],
    recent: [],
  }

  try {
    const rows = await db.select().from(rateAlerts).orderBy(desc(rateAlerts.createdAt))

    const countBy = <T extends string>(pick: (row: (typeof rows)[number]) => T) => {
      const map = new Map<T, number>()
      for (const row of rows) map.set(pick(row), (map.get(pick(row)) ?? 0) + 1)
      return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)
    }

    return {
      total: rows.length,
      confirmed: rows.filter((r) => r.confirmed).length,
      awaitingConfirmation: rows.filter((r) => !r.confirmed).length,
      wantsDigest: rows.filter((r) => r.wantsDigest).length,
      byChannel: countBy((r) => r.channel).map(({ key, count }) => ({ channel: key, count })),
      byCurrency: countBy((r) => r.fromCurrency).map(({ key, count }) => ({
        currency: key,
        count,
      })),
      // Contact details are deliberately absent — the dashboard needs volumes,
      // not addresses, and not displaying them is the simplest way to keep them
      // out of a screenshot.
      recent: rows.slice(0, 15).map((r) => ({
        createdAt: r.createdAt,
        channel: r.channel,
        currency: r.fromCurrency,
        target: toNum(r.targetRate),
        direction: r.direction,
        confirmed: r.confirmed,
      })),
    }
  } catch (error) {
    console.error('[admin] alertStats failed:', error)
    return empty
  }
}

export interface AdapterHealth {
  provider: string
  slug: string
  lastCapture: Date | null
  staleRows: number
  freshRows: number
  sources: string[]
}

/**
 * Per-provider freshness.
 *
 * "Stale adapter" is the thing you most want to notice, and it is invisible on
 * the public site by design — a stale row still shows a number. This is where
 * it surfaces.
 */
export async function adapterHealth(): Promise<AdapterHealth[]> {
  try {
    const rows = (await db.execute(sql`
      SELECT
        ${providers.name} AS provider,
        ${providers.slug} AS slug,
        max(${rateQuotes.capturedAt}) AS "lastCapture",
        count(*) FILTER (WHERE ${rateQuotes.stale})::int      AS "staleRows",
        count(*) FILTER (WHERE NOT ${rateQuotes.stale})::int  AS "freshRows",
        -- FILTER, not a JS-side filter: without it the aggregate over a
        -- provider with no rows returns {NULL}, which rendered literally as
        -- "NULL" in the Source column.
        coalesce(
          array_agg(DISTINCT ${rateQuotes.source})
            FILTER (WHERE ${rateQuotes.source} IS NOT NULL),
          '{}'
        )                                                     AS sources
      FROM ${providers}
      LEFT JOIN ${rateQuotes}
        ON ${rateQuotes.providerId} = ${providers.id}
       AND ${rateQuotes.capturedAt} > now() - interval '24 hours'
      WHERE ${providers.active} AND NOT ${providers.isBenchmark}
      GROUP BY 1, 2
      ORDER BY 1
    `)) as unknown as (Omit<AdapterHealth, 'lastCapture'> & { lastCapture: string | null })[]

    return rows.map((row) => ({
      ...row,
      lastCapture: row.lastCapture ? new Date(row.lastCapture) : null,
      sources: (row.sources ?? []).filter(Boolean),
    }))
  } catch (error) {
    console.error('[admin] adapterHealth failed:', error)
    return []
  }
}

/** Most recent cron runs, so a silently dead GitHub schedule is visible. */
export async function recentCronRuns(limit = 8) {
  try {
    return await db.select().from(cronRuns).orderBy(desc(cronRuns.startedAt)).limit(limit)
  } catch (error) {
    console.error('[admin] recentCronRuns failed:', error)
    return []
  }
}

/** Providers with their monetisation config, for the affiliate settings page. */
export async function providerSettings() {
  try {
    return await db
      .select({
        id: providers.id,
        slug: providers.slug,
        name: providers.name,
        homepageUrl: providers.homepageUrl,
        affiliateNetwork: providers.affiliateNetwork,
        affiliateUrlTemplate: providers.affiliateUrlTemplate,
        commissionNote: providers.commissionNote,
        featured: providers.featured,
        isBenchmark: providers.isBenchmark,
        active: providers.active,
      })
      .from(providers)
      .orderBy(providers.name)
  } catch (error) {
    console.error('[admin] providerSettings failed:', error)
    return []
  }
}

/** Clicks per provider that would earn commission versus those that cannot. */
export async function monetisationGap() {
  try {
    const rows = (await db.execute(sql`
      SELECT
        ${providers.name} AS provider,
        ${providers.affiliateUrlTemplate} IS NOT NULL AS monetised,
        count(${affiliateClicks.id})::int AS clicks
      FROM ${providers}
      LEFT JOIN ${affiliateClicks} ON ${affiliateClicks.providerId} = ${providers.id}
      WHERE ${providers.active} AND NOT ${providers.isBenchmark}
      GROUP BY 1, 2
      ORDER BY 3 DESC
    `)) as unknown as { provider: string; monetised: boolean; clicks: number }[]

    return rows
  } catch (error) {
    console.error('[admin] monetisationGap failed:', error)
    return []
  }
}

export interface ProofDay {
  date: string
  comparisonsRun: number
  clicks: number
  savingPkrTotal: number
  bestProviderChanges: number
}

/**
 * The daily proof series for the admin chart.
 *
 * Reads `site_stats_daily` rather than aggregating the raw tables, so the chart
 * and the public claims are looking at the same rollup. A day with no row is
 * returned as zeroes rather than skipped, otherwise the chart would compress
 * quiet days out of existence and misrepresent the shape.
 */
export async function proofByDay(days = 30): Promise<ProofDay[]> {
  try {
    const rows = (await db.execute(sql`
      SELECT
        d.day::text                            AS date,
        coalesce(s.comparisons_run, 0)         AS "comparisonsRun",
        coalesce(s.clicks, 0)                  AS clicks,
        coalesce(s.saving_pkr_total, 0)::float AS "savingPkrTotal",
        coalesce(s.best_provider_changes, 0)   AS "bestProviderChanges"
      FROM generate_series(
             (current_date - make_interval(days => ${days}))::date,
             current_date,
             interval '1 day'
           ) AS d(day)
      LEFT JOIN site_stats_daily s ON s.date = d.day::text
      ORDER BY 1
    `)) as unknown as ProofDay[]

    return rows
  } catch (error) {
    console.error('[admin] proofByDay failed:', error)
    return []
  }
}
