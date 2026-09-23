/**
 * The notifier contract.
 *
 * One interface, three implementations: Resend for email, Twilio for
 * WhatsApp/SMS, and a console logger used whenever credentials are absent.
 * Nothing in the alert pipeline knows which is in play, so swapping Twilio for
 * a different WhatsApp provider is a one-file change.
 *
 * `send` never throws. A failed message must not abort the cron run or lose the
 * other alerts queued behind it — the result says what happened and the caller
 * decides whether to record a trigger.
 */
export type Channel = 'email' | 'whatsapp' | 'sms'

export interface Message {
  /** Email address or E.164 phone number. */
  to: string
  channel: Channel
  /** Ignored by SMS and WhatsApp, which have no subject line. */
  subject: string
  /** Plain text. Every channel can render it, and it is what SMS sends. */
  text: string
  /** Optional HTML body, used by email only. */
  html?: string
  /** Optional email transport headers, e.g. one-click unsubscribe. */
  headers?: Record<string, string>
}

export interface SendResult {
  ok: boolean
  /** Provider's message id, when it gives one. Useful for support requests. */
  id?: string
  error?: string
  /** True when no credentials were configured and the message was only logged. */
  simulated?: boolean
}

export interface Notifier {
  name: string
  /** Channels this notifier can actually deliver. */
  supports(channel: Channel): boolean
  send(message: Message): Promise<SendResult>
}
