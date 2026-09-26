import type { DeliveryMethod } from '@/lib/db/schema'
import type { PayoutOption } from '@/components/select-icons'

/**
 * Payout destinations shown in the "Recipient gets it in" selector, and the
 * quoted rail each one reads from. Lives outside the client components so the
 * /compare server page can resolve a URL parameter with the same table.
 */
export const PAYOUT_OPTIONS: PayoutOption[] = [
  'bank',
  'jazzcash',
  'easypaisa',
  'sadapay',
  'nayapay',
  'cash',
  'rda',
]

export const PAYOUT_METHOD: Record<PayoutOption, DeliveryMethod> = {
  bank: 'bank',
  jazzcash: 'wallet',
  easypaisa: 'wallet',
  sadapay: 'bank',
  nayapay: 'bank',
  cash: 'cash',
  rda: 'bank',
}

export function isPayoutOption(value: unknown): value is PayoutOption {
  return typeof value === 'string' && (PAYOUT_OPTIONS as string[]).includes(value)
}

/** Named account destinations quoted on the general bank-deposit rail. */
export function isNamedBankAccount(option: PayoutOption): boolean {
  return option === 'sadapay' || option === 'nayapay' || option === 'rda'
}

export function initialPayoutOption(method: DeliveryMethod): PayoutOption {
  if (method === 'wallet') return 'jazzcash'
  if (method === 'neobank') return 'sadapay'
  return method
}
