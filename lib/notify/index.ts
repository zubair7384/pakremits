import { consoleNotifier } from './console'
import { resendNotifier } from './resend'
import { twilioNotifier } from './twilio'
import type { Channel, Message, Notifier, SendResult } from './types'

export type { Channel, Message, Notifier, SendResult }

/**
 * Pick a notifier for a channel.
 *
 * Falls back to the console notifier when credentials are missing rather than
 * failing, so a fresh clone can exercise the entire alert pipeline before
 * anyone signs up to Resend. The fallback is loud in the logs — it is not
 * something you could ship to production without noticing.
 */
export function notifierFor(channel: Channel): Notifier {
  if (channel === 'email') {
    return process.env.RESEND_API_KEY && process.env.RESEND_FROM
      ? resendNotifier
      : consoleNotifier
  }

  const twilioReady =
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    (channel === 'whatsapp' ? process.env.TWILIO_WHATSAPP_FROM : process.env.TWILIO_SMS_FROM)

  return twilioReady ? twilioNotifier : consoleNotifier
}

/** Send through whichever notifier serves the message's channel. */
export async function send(message: Message): Promise<SendResult> {
  const notifier = notifierFor(message.channel)

  if (!notifier.supports(message.channel)) {
    return { ok: false, error: `${notifier.name} cannot send ${message.channel}` }
  }

  return notifier.send(message)
}
