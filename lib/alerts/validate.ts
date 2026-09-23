import parsePhoneNumberFromString from 'libphonenumber-js'
import { z } from 'zod'
import { SEND_CURRENCIES } from '@/lib/db/schema'

/**
 * Alert signup validation.
 *
 * Phone numbers go through libphonenumber-js rather than a regex. Our senders
 * are in eight countries with wildly different number shapes, and a regex that
 * accepts them all accepts nearly anything — which means silently storing
 * undeliverable numbers and never knowing.
 */
export const AlertInputSchema = z
  .object({
    channel: z.enum(['email', 'whatsapp', 'sms']),
    contact: z.string().trim().min(3).max(200),
    fromCurrency: z.enum(SEND_CURRENCIES),
    // A rate below 1 or above 10,000 is a typo, not a target. The real pairs
    // run from about 70 (AED) to about 380 (GBP).
    targetRate: z.coerce
      .number({ message: 'Enter a target rate, like 380.' })
      .min(1, { message: 'That target looks too low. Rates to PKR start around 70.' })
      .max(10_000, { message: 'That target looks too high. Rates to PKR top out under 400.' }),
    direction: z.enum(['above', 'below']),
    wantsDigest: z.coerce.boolean().default(false),
    turnstileToken: z.string().min(1).max(2048),
  })
  .superRefine((input, ctx) => {
    if (input.channel === 'email') {
      const parsed = z.string().email().safeParse(input.contact)
      if (!parsed.success) {
        ctx.addIssue({
          code: 'custom',
          path: ['contact'],
          message: 'That does not look like an email address.',
        })
      }
      return
    }

    const phone = parsePhoneNumberFromString(input.contact)
    if (!phone || !phone.isValid()) {
      ctx.addIssue({
        code: 'custom',
        path: ['contact'],
        // Deliberately no example number. The obvious one to reach for,
        // +44 7700 900123, is Ofcom's reserved drama range — which this very
        // validator rejects, so quoting it would tell someone to enter a
        // number we then refuse. Naming country codes avoids that entirely.
        message:
          'Include your country code — +44 for the UK, +971 for the UAE, +966 for Saudi Arabia.',
      })
    }
  })

export type AlertInput = z.infer<typeof AlertInputSchema>

/**
 * Canonical storage form for a contact.
 *
 * Emails are lowercased so the same address cannot be stored twice in
 * different cases; phone numbers are normalised to E.164 so a number entered
 * as "07700 900123" and as "+44 7700 900123" is recognised as one person.
 */
export function normaliseContact(channel: AlertInput['channel'], contact: string): string {
  if (channel === 'email') return contact.trim().toLowerCase()

  const phone = parsePhoneNumberFromString(contact.trim())
  // Validation has already run, so this is defensive rather than expected.
  return phone?.number ?? contact.trim()
}
