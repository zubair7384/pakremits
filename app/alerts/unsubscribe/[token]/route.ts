/**
 * Unsubscribe endpoint.
 *
 * This deletes the row rather than flagging it inactive. The privacy policy
 * says contact details are deleted on unsubscribe and that we keep no
 * suppression list — holding an address in order to remember not to write to
 * it is still holding the address.
 *
 * A GET only opens the confirmation screen, so mail scanners cannot delete an
 * alert by following a link. Explicit browser confirmation and RFC 8058 inbox
 * one-click requests use POST. Deletion is idempotent.
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
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.url

  return NextResponse.redirect(
    new URL(isPlausibleToken(token) ? `/alerts/unsubscribe/${token}/confirm` : '/?alert=invalid', baseUrl),
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
  const body = await request.text()
  const form = new URLSearchParams(body)
  const isBrowserConfirmation = form.get('confirm') === '1'
  const isInboxOneClick = form.get('List-Unsubscribe') === 'One-Click'

  if (!isBrowserConfirmation && !isInboxOneClick) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const outcome = await unsubscribe(token)

  if (isBrowserConfirmation) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.url
    return NextResponse.redirect(
      new URL(outcome === 'done' ? '/alerts/removed' : `/?alert=${outcome}`, baseUrl),
      303,
    )
  }

  return NextResponse.json({ ok: outcome === 'done' }, { status: outcome === 'done' ? 200 : 400 })
}
