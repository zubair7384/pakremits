/**
 * One-click unsubscribe.
 *
 * This deletes the row rather than flagging it inactive. The privacy policy
 * says contact details are deleted on unsubscribe and that we keep no
 * suppression list — holding an address in order to remember not to write to
 * it is still holding the address.
 *
 * Idempotent, because it is a link in an email: a second click, or a scanner
 * prefetching it, finds nothing to delete and still reports success.
 */
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateAlerts } from '@/lib/db/schema'
import { isPlausibleToken } from '@/lib/alerts/tokens'

export const dynamic = 'force-dynamic'

async function unsubscribe(token: string): Promise<'done' | 'invalid' | 'error'> {
  if (!isPlausibleToken(token)) return 'invalid'

  try {
    await db.delete(rateAlerts).where(eq(rateAlerts.unsubscribeToken, token))
    return 'done'
  } catch (error) {
    console.error('[alerts] unsubscribe failed:', error)
    return 'error'
  }
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const outcome = await unsubscribe(token)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.url

  return NextResponse.redirect(
    new URL(outcome === 'done' ? '/alerts/removed' : `/?alert=${outcome}`, baseUrl),
    302,
  )
}

/**
 * RFC 8058 one-click unsubscribe sends a POST. Supporting it means Gmail and
 * Outlook can show their own unsubscribe button, which measurably reduces the
 * spam complaints that would otherwise damage sender reputation.
 */
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const outcome = await unsubscribe(token)

  return NextResponse.json({ ok: outcome === 'done' }, { status: outcome === 'done' ? 200 : 400 })
}
