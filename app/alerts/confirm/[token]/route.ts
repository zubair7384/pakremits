/**
 * Double opt-in confirmation.
 *
 * A GET, because it is a link in an email and email clients only follow links.
 * That means it must be idempotent — clicking twice, or a mail scanner
 * prefetching it, has to be harmless.
 */
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateAlerts } from '@/lib/db/schema'
import { isPlausibleToken } from '@/lib/alerts/tokens'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params
  const manage = new URL(`/alerts/manage/${token}`, request.url)

  if (!isPlausibleToken(token)) {
    return NextResponse.redirect(new URL('/?alert=invalid', request.url), 302)
  }

  try {
    const [alert] = await db
      .select({ id: rateAlerts.id, confirmed: rateAlerts.confirmed })
      .from(rateAlerts)
      .where(eq(rateAlerts.unsubscribeToken, token))
      .limit(1)

    if (!alert) {
      // Most likely an unconfirmed alert that aged out after 48 hours.
      return NextResponse.redirect(new URL('/?alert=expired', request.url), 302)
    }

    if (!alert.confirmed) {
      await db
        .update(rateAlerts)
        .set({ confirmed: true, confirmedAt: new Date(), active: true })
        .where(eq(rateAlerts.id, alert.id))
    }

    manage.searchParams.set('confirmed', '1')
    return NextResponse.redirect(manage, 302)
  } catch (error) {
    console.error('[alerts] confirm failed:', error)
    return NextResponse.redirect(new URL('/?alert=error', request.url), 302)
  }
}
