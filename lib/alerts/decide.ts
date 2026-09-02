/**
 * The trigger decision, as a pure function.
 *
 * Kept free of I/O so every branch is unit-testable: the rate-limit window,
 * the direction comparison, the unconfirmed-email case. Getting this wrong
 * either spams someone or silently never fires, and both are the kind of bug
 * you only notice in production.
 */

/** Promised on the signup form: "max once every 12 hours". */
export const RATE_LIMIT_HOURS = 12

/** A digest is weekly, on its own clock. */
export const DIGEST_INTERVAL_HOURS = 24 * 7

export interface AlertState {
  direction: 'above' | 'below'
  targetRate: number
  active: boolean
  confirmed: boolean
  channel: 'email' | 'whatsapp' | 'sms'
  lastTriggeredAt: Date | null
}

export type TriggerDecision =
  | { fire: true }
  | {
      fire: false
      /** Machine-readable so /admin can count why alerts are not firing. */
      reason:
        | 'inactive'
        | 'unconfirmed'
        | 'threshold-not-crossed'
        | 'rate-limited'
        | 'no-rate-available'
    }

/**
 * Should this alert fire right now?
 *
 * `currentRate` is the best rate a sender could actually obtain — see
 * evaluate.ts for why that is not the mid-market rate.
 */
export function decideTrigger(
  alert: AlertState,
  currentRate: number | null,
  now: Date = new Date(),
): TriggerDecision {
  if (!alert.active) return { fire: false, reason: 'inactive' }

  // Double opt-in gates email only, per the brief. Phone channels are live on
  // creation.
  // TODO: before enabling Twilio in production, add a confirm step for phone
  // too — as it stands, anyone could enter someone else's number and cause
  // them to be messaged.
  if (alert.channel === 'email' && !alert.confirmed) {
    return { fire: false, reason: 'unconfirmed' }
  }

  if (currentRate === null || !Number.isFinite(currentRate) || currentRate <= 0) {
    return { fire: false, reason: 'no-rate-available' }
  }

  const crossed =
    alert.direction === 'above'
      ? currentRate >= alert.targetRate
      : currentRate <= alert.targetRate

  if (!crossed) return { fire: false, reason: 'threshold-not-crossed' }

  // Rate limit last: an alert held back by the window has genuinely crossed,
  // and ordering the checks this way keeps the /admin reasons meaningful.
  if (alert.lastTriggeredAt) {
    const elapsedHours = (now.getTime() - alert.lastTriggeredAt.getTime()) / 3_600_000
    if (elapsedHours < RATE_LIMIT_HOURS) return { fire: false, reason: 'rate-limited' }
  }

  return { fire: true }
}

/** Is a weekly digest due? Independent of the trigger clock. */
export function digestDue(
  alert: { active: boolean; confirmed: boolean; wantsDigest: boolean; lastDigestAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (!alert.active || !alert.wantsDigest || !alert.confirmed) return false
  if (!alert.lastDigestAt) return true

  const elapsedHours = (now.getTime() - alert.lastDigestAt.getTime()) / 3_600_000
  return elapsedHours >= DIGEST_INTERVAL_HOURS
}
