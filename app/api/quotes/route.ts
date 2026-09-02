/**
 * Quotes endpoint for the interactive comparison panel.
 *
 * The home page renders a full table server-side; this route only serves the
 * updates when the user changes country, method, or amount. Everything it
 * returns is already computed — the client does no ranking or arithmetic, so
 * there is exactly one implementation of the ranking rules.
 */
import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { DELIVERY_METHODS } from '@/lib/db/schema'
import { CORRIDORS } from '@/lib/corridors'
import { getComparison } from '@/lib/quotes'
import { SESSION_COOKIE, recordComparisonRun } from '@/lib/proof/events'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  corridor: z.enum(CORRIDORS.map((c) => c.slug) as [string, ...string[]]),
  method: z.enum(DELIVERY_METHODS).default('bank'),
  // Capped well above any realistic remittance: past this the standard-amount
  // grid stops being a reasonable approximation.
  amount: z.coerce.number().positive().max(1_000_000).default(500),
  sort: z.enum(['received', 'fastest', 'lowest-fee']).default('received'),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid query' },
      { status: 400 },
    )
  }

  const { corridor, method, amount, sort } = parsed.data

  try {
    const comparison = await getComparison({
      corridorSlug: corridor,
      method,
      amount,
      sortBy: sort,
    })

    if (!comparison) {
      return NextResponse.json({ error: 'Unknown corridor' }, { status: 404 })
    }

    // Count the comparison. Deduplicated to one per session per minute inside
    // recordComparisonRun, so dragging the amount field is one event, not forty.
    const jar = await cookies()
    let sessionId = jar.get(SESSION_COOKIE)?.value
    const isNewSession = !sessionId
    if (!sessionId) sessionId = randomUUID()

    await recordComparisonRun(sessionId, comparison.corridorId ?? null)

    const response = NextResponse.json(comparison, {
      headers: {
        // Per-session counting makes this response session-specific, so it can
        // no longer sit in a shared CDN cache. `private` keeps the browser
        // cache — which still absorbs a dragged slider — without one visitor's
        // response being served to another.
        'cache-control': 'private, max-age=60',
      },
    })

    if (isNewSession) {
      response.cookies.set(SESSION_COOKIE, sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        // Long enough to deduplicate a visit, short enough not to be a
        // durable identifier. Nothing personal is stored against it.
        maxAge: 60 * 60 * 24,
      })
    }

    return response
  } catch (error) {
    console.error('[api/quotes] failed:', error)
    return NextResponse.json({ error: 'Could not load quotes' }, { status: 500 })
  }
}
