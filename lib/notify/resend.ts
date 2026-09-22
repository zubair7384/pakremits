import type { Message, Notifier, SendResult } from './types'

/**
 * Email via Resend's REST API.
 *
 * Called with fetch rather than the `resend` SDK: the request is one POST, and
 * the interface in types.ts is the abstraction that matters. One fewer
 * dependency in a project that has to stay on free tiers.
 */
export const resendNotifier: Notifier = {
  name: 'resend',

  supports: (channel) => channel === 'email',

  async send(message: Message): Promise<SendResult> {
    const key = process.env.RESEND_API_KEY
    const from = process.env.RESEND_FROM

    if (!key || !from) {
      return { ok: false, error: 'RESEND_API_KEY or RESEND_FROM is not set' }
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
          ...(message.headers ? { headers: message.headers } : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        return { ok: false, error: `Resend HTTP ${response.status}: ${body.slice(0, 200)}` }
      }

      const payload = (await response.json()) as { id?: string }
      return { ok: true, id: payload.id }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  },
}
