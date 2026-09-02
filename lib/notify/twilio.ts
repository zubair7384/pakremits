import type { Channel, Message, Notifier, SendResult } from './types'

/**
 * WhatsApp and SMS via Twilio's REST API.
 *
 * Deliberately a thin wrapper over one form POST, per the brief's "stub behind
 * an interface so it can be swapped". No SDK, so replacing Twilio with
 * MessageBird or Meta's own WhatsApp Cloud API means writing one new file that
 * satisfies `Notifier` and changing the registry entry.
 */
function twilioFrom(channel: Channel): string | undefined {
  return channel === 'whatsapp'
    ? process.env.TWILIO_WHATSAPP_FROM
    : process.env.TWILIO_SMS_FROM
}

export const twilioNotifier: Notifier = {
  name: 'twilio',

  supports: (channel) => channel === 'whatsapp' || channel === 'sms',

  async send(message: Message): Promise<SendResult> {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    const from = twilioFrom(message.channel)

    if (!sid || !token || !from) {
      return { ok: false, error: `Twilio credentials or ${message.channel} sender not set` }
    }

    // WhatsApp addresses are prefixed; SMS uses the bare E.164 number.
    const to = message.channel === 'whatsapp' ? `whatsapp:${message.to}` : message.to

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: to, From: from, Body: message.text }),
          signal: AbortSignal.timeout(15_000),
        },
      )

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        return { ok: false, error: `Twilio HTTP ${response.status}: ${body.slice(0, 200)}` }
      }

      const payload = (await response.json()) as { sid?: string }
      return { ok: true, id: payload.sid }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  },
}
