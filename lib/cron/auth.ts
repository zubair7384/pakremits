import { timingSafeEqual } from 'node:crypto'

/**
 * Constant-time secret check for the cron routes.
 *
 * Accepts either `Authorization: Bearer <secret>` (what Vercel Cron sends) or
 * `x-cron-secret` (simpler to set from a GitHub Actions step).
 */
export function isAuthorisedCronRequest(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('[cron] CRON_SECRET is not set — refusing every request')
    return false
  }

  const header =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    request.headers.get('x-cron-secret') ??
    ''

  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  return a.length === b.length && timingSafeEqual(a, b)
}
