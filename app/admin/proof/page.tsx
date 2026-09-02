import type { Metadata } from 'next'
import { AdminNav, Empty, Panel } from '@/components/admin-chrome'
import { proofByDay } from '@/lib/admin/stats'
import { listBenchmarks } from '@/lib/proof/benchmarks'
import { evaluateClaims } from '@/lib/proof/claims'
import { LAUNCH_DATE, THRESHOLDS } from '@/lib/proof/config'
import { formatProofPkrFull } from '@/lib/proof/format'
import { getProofStats } from '@/lib/proof/stats'
import { BenchmarkForm } from './benchmark-form'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Proof and savings — PakRemits admin',
  robots: { index: false },
}

/** Human-readable label per claim id, matching the copy on the public page. */
const CLAIM_LABELS: Record<string, string> = {
  pakistanOnly: 'Built only for Pakistan corridors',
  providersRefreshed: 'N providers compared, refreshed every N minutes',
  liveGap: '₨ N more than a typical bank, right now',
  rankedByRupees: 'Ranked by rupees received',
  monthlyActivity: 'N comparisons run this month',
  savingsSinceLaunch: '₨ N saved since launch',
  firstPakistanOnlySite: "Pakistan's first Pakistan-only comparison site",
}

export default async function AdminProofPage() {
  const [stats, series, benchmarks] = await Promise.all([
    // `fresh` bypasses the 5-minute memo: an admin looking at this page wants
    // the current numbers, not whatever the last public request cached.
    getProofStats({ fresh: true }),
    proofByDay(30),
    listBenchmarks(),
  ])

  // The admin panel evaluates with a null live gap because that figure depends
  // on the widget's corridor and amount, which do not exist outside a visitor's
  // session. It is listed as "varies per request" rather than shown as hidden.
  const claims = evaluateClaims({ stats, liveGapOnStandardAmount: null })

  const maxSaving = Math.max(...series.map((d) => d.savingPkrTotal), 1)
  const maxCount = Math.max(...series.map((d) => Math.max(d.comparisonsRun, d.clicks)), 1)

  return (
    <>
      <AdminNav current="/admin/proof" />

      <main className="mx-auto max-w-[1200px] space-y-6 px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Saved since launch" value={formatProofPkrFull(stats.savingsSinceLaunch)} />
          <Stat label="Saved this month" value={formatProofPkrFull(stats.savingsThisMonth)} />
          <Stat
            label="Comparisons this month"
            value={stats.comparisonsThisMonth.toLocaleString('en-GB')}
          />
          <Stat
            label="Leader changes this month"
            value={String(stats.bestProviderChangesThisMonth)}
          />
        </div>

        <Panel
          title="Claims currently visible"
          hint={`Evaluated against live numbers. Launch date ${LAUNCH_DATE.toISOString().slice(0, 10)}.`}
        >
          <ul className="space-y-2">
            {claims.map((claim) => (
              <li key={claim.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  className={`inline-block w-16 shrink-0 rounded-control px-2 py-0.5 text-center
                              text-[12px] font-medium ${
                                claim.visible
                                  ? 'bg-leaf/15 text-leaf'
                                  : 'bg-line-2 text-muted'
                              }`}
                >
                  {claim.visible ? 'live' : 'hidden'}
                </span>
                <span className="text-[14px] text-ink">
                  {CLAIM_LABELS[claim.id] ?? claim.id}
                </span>
                <span className="text-[13px] text-muted">
                  {claim.id === 'liveGap'
                    ? 'Varies per request — depends on the corridor and amount in the widget.'
                    : claim.reason}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Daily activity"
          hint={`Last 30 days. Bars are savings; the two lines under each are comparisons and clicks. Savings appear on the site past ${formatProofPkrFull(THRESHOLDS.savingsSinceLaunch)}.`}
        >
          {series.length === 0 ? (
            <Empty>No rollup rows yet. The cron writes these at the end of each run.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <th scope="col" className="py-2 pr-3 font-medium">Day</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Saving</th>
                    <th scope="col" className="w-1/3 py-2 pr-3 font-medium">&nbsp;</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Comparisons</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Clicks</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Leader changes</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((day) => (
                    <tr key={day.date} className="border-b border-line/60">
                      <td className="py-1.5 pr-3 tabular-nums text-muted">{day.date.slice(5)}</td>
                      <td className="py-1.5 pr-3 tabular-nums text-ink">
                        {Math.round(day.savingPkrTotal).toLocaleString('en-GB')}
                      </td>
                      <td className="py-1.5 pr-3">
                        {/* A CSS bar rather than a charting library: one column
                            of 30 values does not justify shipping a dependency. */}
                        <span
                          className="block h-2 rounded-full bg-leaf/70"
                          style={{
                            width: `${Math.max((day.savingPkrTotal / maxSaving) * 100, day.savingPkrTotal > 0 ? 2 : 0)}%`,
                          }}
                          aria-hidden="true"
                        />
                        <span
                          className="mt-1 block h-1 rounded-full bg-green/40"
                          style={{
                            width: `${Math.max((day.comparisonsRun / maxCount) * 100, day.comparisonsRun > 0 ? 2 : 0)}%`,
                          }}
                          aria-hidden="true"
                        />
                      </td>
                      <td className="py-1.5 pr-3 tabular-nums">{day.comparisonsRun}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{day.clicks}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{day.bestProviderChanges}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          title="Bank benchmarks"
          hint="What the savings figure is measured against. Saving a row pins it, which stops the weekly refresh regenerating it."
        >
          {benchmarks.length === 0 ? (
            <Empty>
              No benchmarks yet. They are generated on the first cron run, or seeded by
              <code className="mx-1">npm run seed</code>.
            </Empty>
          ) : (
            <table className="w-full border-collapse text-[13.5px]">
              <tbody>
                {benchmarks.map((row) => (
                  <BenchmarkForm
                    key={`${row.corridorId}-${row.deliveryMethod}`}
                    row={{
                      corridorId: row.corridorId,
                      countryName: row.countryName,
                      currency: row.currency,
                      deliveryMethod: row.deliveryMethod,
                      rate: row.rate,
                      fee: row.fee,
                      note: row.note,
                      pinned: row.pinned,
                      updatedAt: row.updatedAt,
                    }}
                  />
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </main>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-panel border border-line bg-white p-4">
      <div className="font-display text-[20px] font-semibold text-green">{value}</div>
      <p className="mt-1 text-[13px] text-muted">{label}</p>
    </div>
  )
}
