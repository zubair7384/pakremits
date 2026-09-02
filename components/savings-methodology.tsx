import Link from 'next/link'
import { LAUNCH_DATE, THRESHOLDS } from '@/lib/proof/config'
import { formatProofPkrFull } from '@/lib/proof/format'
import { listBenchmarks } from '@/lib/proof/benchmarks'
import { getProofStats } from '@/lib/proof/stats'

const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/**
 * /how-we-rank#savings — the page every proof number links to.
 *
 * The point of this section is that a reader who distrusts the headline figure
 * can find out exactly what it counts and decide for themselves. So it states
 * the limitations in the same size type as the total, and shows the benchmark
 * table with its update dates rather than describing it in prose.
 */
export async function SavingsMethodology() {
  const [stats, benchmarks] = await Promise.all([getProofStats(), listBenchmarks()])

  return (
    <section id="savings" className="mt-10 scroll-mt-8">
      <h2 className="text-[26px] leading-tight font-semibold">How we count savings</h2>

      <div className="mt-3 space-y-4 text-[16.5px] text-muted">
        <p>
          We started counting on {DATE.format(LAUNCH_DATE)}. Since then the total is{' '}
          <b className="text-ink">{formatProofPkrFull(stats.savingsSinceLaunch)}</b>, which is the
          sum of every row in the ledger described below — not a projection from a sample, and not
          a figure anyone types in.
        </p>
        <p>
          A row is written at one moment only: when someone clicks through from a comparison table
          to a provider. We take the amount they entered, the provider’s rate and fee at that
          second, and the bank benchmark for that corridor and rail, and store the difference. If
          the rate moves a minute later the stored row does not follow it.
        </p>
        <p>
          Nothing is backfilled or estimated. Where a corridor has no benchmark we still record the
          click, with the saving left empty, and that row is excluded from the total rather than
          filled in with a default.
        </p>
      </div>

      <h3 className="mt-8 text-[19px] font-semibold">What “a typical high-street bank” means</h3>
      <div className="mt-3 space-y-4 text-[16.5px] text-muted">
        <p>
          Not a quote from any specific bank. Each figure below is the mid-market rate for that
          corridor less a typical retail markup, plus a typical wire fee, refreshed weekly. Where
          we have a real quote from a named bank we enter it by hand, which pins the row and takes
          it out of the weekly refresh.
        </p>
      </div>

      {benchmarks.length > 0 ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[14.5px]">
            <caption className="pb-2 text-left text-[13px] text-muted">
              Current bank benchmarks, as stored.
            </caption>
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Corridor</th>
                <th scope="col" className="py-2 pr-4 font-medium">Recipient gets it in</th>
                <th scope="col" className="py-2 pr-4 font-medium">Rate</th>
                <th scope="col" className="py-2 pr-4 font-medium">Fee</th>
                <th scope="col" className="py-2 pr-4 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((row) => (
                <tr
                  key={`${row.corridorId}-${row.deliveryMethod}`}
                  className="border-b border-line/60"
                >
                  <td className="py-2 pr-4 text-ink">{row.countryName}</td>
                  <td className="py-2 pr-4">{row.deliveryMethod}</td>
                  <td className="py-2 pr-4 tabular-nums">{row.rate.toFixed(4)}</td>
                  <td className="py-2 pr-4 tabular-nums">
                    {row.fee.toFixed(2)} {row.currency}
                  </td>
                  <td className="py-2 pr-4">
                    {DATE.format(row.updatedAt)}
                    {row.pinned ? ' · entered by hand' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-[16.5px] text-muted">
          No benchmarks are recorded yet, so no savings are being counted.
        </p>
      )}

      <h3 className="mt-8 text-[19px] font-semibold">What this figure is not</h3>
      <div className="mt-3 space-y-4 text-[16.5px] text-muted">
        <p>
          <b className="text-ink">We count clicks, not confirmed transfers.</b> We know someone left
          for a provider with a given amount in the box. We do not know whether they completed the
          transfer, changed the amount on the provider’s own site, or abandoned it. Nobody sends us
          that information, and we would rather say so than imply an accuracy we do not have.
        </p>
        <p>
          <b className="text-ink">The benchmark is indicative.</b> It is a reasonable stand-in for
          a high-street bank, not a measurement of the one you use. If your bank is better than the
          benchmark, the saving on your transfer was smaller than the row we recorded.
        </p>
        <p>
          <b className="text-ink">It is avoided cost, not money in an account.</b> The figure
          estimates what these transfers would have cost through a typical bank instead. It is not
          audited, and it is not a claim about anyone’s balance.
        </p>
      </div>

      <p className="mt-6 text-[14.5px] text-muted">
        The total appears on the home page only once it passes{' '}
        {formatProofPkrFull(THRESHOLDS.savingsSinceLaunch)}. Below that we show no figure at all
        rather than a small one dressed up as a milestone.{' '}
        <Link href="/contact" className="text-leaf underline underline-offset-2">
          Tell us
        </Link>{' '}
        if you think the arithmetic here is wrong.
      </p>
    </section>
  )
}
