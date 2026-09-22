/**
 * Alert signup.
 *
 * Email signups create an unconfirmed row and send a double opt-in link;
 * nothing is sent to that address until the link is used, and the row is
 * deleted after 48 hours if it never is.
 */
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateAlerts } from '@/lib/db/schema'
import { AlertInputSchema, normaliseContact } from '@/lib/alerts/validate'
import { generateAlertToken } from '@/lib/alerts/tokens'
import { composeConfirmMessage } from '@/lib/alerts/messages'
import { send } from '@/lib/notify'

export const dynamic = 'force-dynamic'

/** Cap on live alerts per contact, so one address cannot be used as a queue. */
const MAX_ALERTS_PER_CONTACT = 10

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const parsed = AlertInputSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      { error: issue?.message ?? 'Check the details and try again.', field: issue?.path?.[0] },
      { status: 400 },
    )
  }

  const input = parsed.data
  // Phone delivery still needs verified opt-in and approved templates.
  if (process.env.NODE_ENV === 'production' && input.channel !== 'email') {
    return NextResponse.json(
      { error: 'Phone alerts are not available yet. Please use email.' },
      { status: 503 },
    )
  }
  const contact = normaliseContact(input.channel, input.contact)

  try {
    const existing = await db
      .select({ id: rateAlerts.id, currency: rateAlerts.fromCurrency, target: rateAlerts.targetRate, direction: rateAlerts.direction })
      .from(rateAlerts)
      .where(and(eq(rateAlerts.userContact, contact), eq(rateAlerts.active, true)))

    // Silently succeed on an exact duplicate rather than creating a second
    // alert that would double-message them.
    const duplicate = existing.find(
      (row) =>
        row.currency === input.fromCurrency &&
        Number(row.target) === input.targetRate &&
        row.direction === input.direction,
    )
    if (duplicate) {
      return NextResponse.json({ ok: true, alreadyExists: true })
    }

    if (existing.length >= MAX_ALERTS_PER_CONTACT) {
      return NextResponse.json(
        {
          error: `That is already ${MAX_ALERTS_PER_CONTACT} live alerts. Remove one first.`,
        },
        { status: 429 },
      )
    }

    const token = generateAlertToken()
    // Phone channels are live immediately; email waits for the opt-in link.
    const confirmed = input.channel !== 'email'

    const [created] = await db
      .insert(rateAlerts)
      .values({
        userContact: contact,
        channel: input.channel,
        fromCurrency: input.fromCurrency,
        targetRate: String(input.targetRate),
        direction: input.direction,
        confirmed,
        confirmedAt: confirmed ? new Date() : null,
        active: true,
        wantsDigest: input.wantsDigest,
        unsubscribeToken: token,
      })
      .returning({ id: rateAlerts.id })

    if (input.channel === 'email') {
      const message = composeConfirmMessage({
        fromCurrency: input.fromCurrency,
        targetRate: input.targetRate,
        direction: input.direction,
        token,
      })

      const sent = await send({
        to: contact,
        channel: 'email',
        subject: message.subject,
        text: message.text,
      })

      if (!sent.ok) {
        console.error('[alerts] confirmation email failed:', sent.error)
        // Do not leave an unconfirmable duplicate behind. Duplicate detection
        // would otherwise make the next signup report success without sending
        // a fresh link.
        if (created) {
          await db
            .delete(rateAlerts)
            .where(eq(rateAlerts.id, created.id))
            .catch((error) => console.error('[alerts] failed signup cleanup failed:', error))
        }
        return NextResponse.json(
          { error: 'We could not send the confirmation email. Try again shortly.' },
          { status: 502 },
        )
      }
    }

    return NextResponse.json({
      ok: true,
      // Drives which confirmation copy the form shows.
      needsConfirmation: input.channel === 'email',
    })
  } catch (error) {
    console.error('[alerts] signup failed:', error)
    return NextResponse.json({ error: 'Could not create the alert.' }, { status: 500 })
  }
}
