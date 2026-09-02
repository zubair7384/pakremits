import type { Message, Notifier, SendResult } from './types'

/**
 * Development fallback.
 *
 * Prints the message it would have sent and reports success with
 * `simulated: true`. This exists so the whole alert pipeline — evaluation,
 * rate limiting, message composition, trigger recording — can be developed and
 * tested without a Resend or Twilio account, which the README promises.
 *
 * `simulated` matters: the caller records a trigger either way (otherwise local
 * testing would fire the same alert every 15 minutes forever), but /admin can
 * tell a simulated send from a real one.
 */
export const consoleNotifier: Notifier = {
  name: 'console',

  supports: () => true,

  async send(message: Message): Promise<SendResult> {
    console.log(
      [
        '',
        '┌─ alert (not actually sent — no credentials configured) ─────────',
        `│ channel: ${message.channel}`,
        `│ to:      ${message.to}`,
        `│ subject: ${message.subject}`,
        '│',
        ...message.text.split('\n').map((line) => `│ ${line}`),
        '└─────────────────────────────────────────────────────────────────',
        '',
      ].join('\n'),
    )

    return { ok: true, simulated: true }
  },
}
