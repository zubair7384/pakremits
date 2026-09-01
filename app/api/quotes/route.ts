/**
 * Quotes endpoint for the interactive comparison panel.
 *
 * The home page renders a full table server-side; this route only serves the
 * updates when the user changes country, method, or amount. Everything it
 * returns is already computed — the client does no ranking or arithmetic, so
 * there is exactly one implementation of the ranking rules.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { DELIVERY_METHODS } from '@/lib/db/schema'
import { CORRIDORS } from '@/lib/corridors'
import { getComparison } from '@/lib/quotes'

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

    return NextResponse.json(comparison, {
      headers: {
        // Quotes refresh every 15 minutes; a short shared cache absorbs the
        // burst from someone dragging the amount field without going stale.
        'cache-control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('[api/quotes] failed:', error)
    return NextResponse.json({ error: 'Could not load quotes' }, { status: 500 })
  }
}
