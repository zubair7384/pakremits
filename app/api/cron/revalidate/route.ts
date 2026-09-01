/**
 * Cache invalidation hook.
 *
 * The refresh itself runs in GitHub Actions against the database directly, so
 * the deployment never learns that quotes changed. This route is how the
 * workflow tells it to drop cached quote data after a successful refresh.
 */
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { isAuthorisedCronRequest } from '@/lib/cron/auth'

export const dynamic = 'force-dynamic'

/** Cache tag applied to every query that reads quotes. */
export const QUOTES_TAG = 'quotes'

export async function POST(request: Request) {
  if (!isAuthorisedCronRequest(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Next 16 requires a cacheLife profile. `max` expires the entry outright,
  // which is what we want: the quotes it held are now definitively superseded.
  revalidateTag(QUOTES_TAG, 'max')

  return NextResponse.json({ ok: true, revalidated: QUOTES_TAG, at: new Date().toISOString() })
}
