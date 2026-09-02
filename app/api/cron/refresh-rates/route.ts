/**
 * Manual refresh trigger.
 *
 * The *scheduled* refresh does not come through here — a full run takes about
 * four minutes against a 60s function limit, so
 * .github/workflows/refresh-rates.yml runs `npm run refresh` directly against
 * the database instead. This route exists for triggering a run by hand, and
 * will time out on a cold corridor grid. Both paths call the same
 * `runFullRefresh`, so a run started here is recorded identically.
 */
import { NextResponse } from 'next/server'
import { isAuthorisedCronRequest } from '@/lib/cron/auth'
import { runFullRefresh } from '@/lib/cron/run'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  if (!isAuthorisedCronRequest(request)) {
    // 404 rather than 401: no reason to confirm the route exists to a scanner.
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const result = await runFullRefresh('refresh-rates:manual')
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[cron] refresh-rates failed:', error)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
