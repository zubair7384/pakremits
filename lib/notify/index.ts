import { consoleNotifier } from './console'
import { resendNotifier } from './resend'
import { twilioNotifier } from './twilio'
import type { Channel, Message, Notifier, SendResult } from './types'

export type { Channel, Message, Notifier, SendResult }

/**
 * Pick a notifier for a channel.
 *
 * Local development can log simulated sends. Production must fail closed when
 * delivery credentials are absent, rather than accepting undeliverable alerts.
 */
export function notifierFor(channel: Channel): Notifier {
  if (channel === 'email') {
    return process.env.RESEND_API_KEY && process.env.RESEND_FROM
      ? resendNotifier
      : process.env.NODE_ENV === 'production'
        ? resendNotifier
        : consoleNotifier
  }

  const twilioReady =
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    (channel === 'whatsapp' ? process.env.TWILIO_WHATSAPP_FROM : process.env.TWILIO_SMS_FROM)

  if (twilioReady || process.env.NODE_ENV === 'production') return twilioNotifier
  return consoleNotifier
}

/** Send through whichever notifier serves the message's channel. */
export async function send(message: Message): Promise<SendResult> {
  const notifier = notifierFor(message.channel)

  if (!notifier.supports(message.channel)) {
    return { ok: false, error: `${notifier.name} cannot send ${message.channel}` }
  }

  return notifier.send(message)
}
