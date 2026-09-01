/**
 * Affiliate redirect.
 *
 * Logs the click, then 302s to the provider. Two rules shape this:
 *
 *  - The click is logged *before* the redirect, but a logging failure must
 *    never cost the user their transfer. Everything is wrapped so the redirect
 *    happens regardless.
 *  - A provider with no approved affiliate programme still gets a working link
 *    to its homepage. A missing template is the normal pre-approval state, not
 *    an error, and must not produce a dead button.
 */
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { DELIVERY_METHODS, affiliateClicks, corridors, providers } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

const ParamsSchema = z.object({
  corridor: z.string().max(40).optional(),
  amount: z.coerce.number().positive().max(1_000_000).optional(),
  method: z.enum(DELIVERY_METHODS).optional(),
})

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: slug } = await context.params
  const { searchParams } = new URL(request.url)
  const parsed = ParamsSchema.safeParse(Object.fromEntries(searchParams))
  const query = parsed.success ? parsed.data : {}

  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.slug, slug))
    .limit(1)

  if (!provider || !provider.active) {
    return NextResponse.redirect(new URL('/providers', request.url), 302)
  }

  // The benchmark row is not a real product and must never link out.
  if (provider.isBenchmark) {
    return NextResponse.redirect(new URL('/how-we-rank#bank-benchmark', request.url), 302)
  }

  const clickId = randomUUID()

  // Resolve the corridor for reporting. Best-effort — a bad slug in the query
  // string should not stop the redirect.
  let corridorId: number | null = null
  if (query.corridor) {
    const [corridor] = await db
      .select({ id: corridors.id })
      .from(corridors)
      .where(eq(corridors.slug, query.corridor))
      .limit(1)
      .catch(() => [])
    corridorId = corridor?.id ?? null
  }

  try {
    await db.insert(affiliateClicks).values({
      providerId: provider.id,
      corridorId,
      amountSent: query.amount ? String(query.amount) : null,
      deliveryMethod: query.method ?? null,
      clickId,
      referrer: request.headers.get('referer'),
      // Preserve campaign attribution without storing anything identifying.
      utm: [...searchParams.entries()]
        .filter(([key]) => key.startsWith('utm_'))
        .map(([key, value]) => `${key}=${value}`)
        .join('&') || null,
    })
  } catch (error) {
    // Losing a click row is bad for reporting and irrelevant to the user.
    console.error('[go] click logging failed:', error)
  }

  const destination = provider.affiliateUrlTemplate
    ? provider.affiliateUrlTemplate
        .replace('{clickId}', encodeURIComponent(clickId))
        .replace('{destination}', encodeURIComponent(provider.homepageUrl))
    : provider.homepageUrl

  if (!destination) {
    return NextResponse.redirect(new URL('/providers', request.url), 302)
  }

  return NextResponse.redirect(destination, {
    status: 302,
    headers: {
      // Never cache a redirect that mints a per-click tracking id.
      'cache-control': 'no-store, max-age=0',
      // Do not leak the amount someone is sending to the provider's analytics.
      'referrer-policy': 'origin',
    },
  })
}
