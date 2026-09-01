/**
 * The arithmetic behind every number on the site. Pure, dependency-free, and
 * unit-tested — nothing here may read the clock, the database, or the network.
 */

/**
 * How a provider applies its fee.
 *
 * - `deducted`: the fee comes out of the amount you hand over, and the remainder
 *   is converted. Wise works this way — send £500, £3.66 fee, £496.34 converted.
 * - `additional`: the fee is charged on top, and the full amount is converted.
 *   You are out of pocket `amount + fee`.
 *
 * We default to `deducted` because it makes `amount` mean "total out of pocket"
 * for every provider, which is the only way a comparison table is honest.
 * Adapters reading an `additional`-style provider must say so explicitly.
 */
export type FeeModel = 'deducted' | 'additional'

/** Round half-up to `dp` decimals, avoiding the float drift of `toFixed`. */
export function round(value: number, dp = 2): number {
  const factor = 10 ** dp
  // The epsilon nudge fixes cases like 1.005 * 100 === 100.49999999999999.
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/**
 * The amount that actually lands in the recipient's account, in PKR.
 *
 * This is the single number the whole site ranks by. It is deliberately not
 * "rate" and not "fee" — a provider can win on either and still lose on this.
 *
 * @param amount Amount the sender parts with, in the sending currency.
 * @param rate   Provider's exchange rate, markup already included.
 * @param fee    Provider's fee, in the sending currency.
 * @param feeModel How the fee relates to `amount`. See {@link FeeModel}.
 * @returns PKR received, rounded to 2 decimals. Never negative.
 */
export function computeReceived(
  amount: number,
  rate: number,
  fee: number,
  feeModel: FeeModel = 'deducted',
): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(`amount must be a non-negative number, got ${amount}`)
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new RangeError(`rate must be a positive number, got ${rate}`)
  }
  if (!Number.isFinite(fee) || fee < 0) {
    throw new RangeError(`fee must be a non-negative number, got ${fee}`)
  }

  // A fee larger than the transfer means nothing arrives. Clamp rather than
  // returning a negative, which would sort *above* nothing in a desc ranking.
  const converted = feeModel === 'deducted' ? Math.max(amount - fee, 0) : amount

  return round(converted * rate, 2)
}

/**
 * Total cost to the sender, in the sending currency. Used by the "Lowest fee"
 * sort and by the `additional`-model normalisation in adapters.
 */
export function totalOutOfPocket(
  amount: number,
  fee: number,
  feeModel: FeeModel = 'deducted',
): number {
  return round(feeModel === 'deducted' ? amount : amount + fee, 2)
}

/**
 * The provider's markup against the mid-market rate, as a percentage.
 *
 * Positive means the provider is giving you less than mid-market. Can go
 * slightly negative for providers under the State Bank incentive scheme, which
 * is real and worth showing rather than clamping away.
 */
export function markupPercent(providerRate: number, midMarketRate: number): number {
  if (!Number.isFinite(midMarketRate) || midMarketRate <= 0) {
    throw new RangeError(`midMarketRate must be positive, got ${midMarketRate}`)
  }
  return round(((midMarketRate - providerRate) / midMarketRate) * 100, 3)
}

/**
 * The true all-in cost of a transfer expressed in the sending currency: the
 * explicit fee plus whatever the rate markup quietly took.
 *
 * This is what powers "₨ X more than your bank" once converted back to PKR.
 */
export function effectiveCost(
  amount: number,
  rate: number,
  fee: number,
  midMarketRate: number,
  feeModel: FeeModel = 'deducted',
): number {
  const received = computeReceived(amount, rate, fee, feeModel)
  const receivedAtMid = round(amount * midMarketRate, 2)
  return round((receivedAtMid - received) / midMarketRate, 2)
}

/** Format PKR the way the design does: `₨ 178,000`. */
export function formatPkr(amount: number, opts?: { decimals?: number }): string {
  const decimals = opts?.decimals ?? 0
  return `₨ ${amount.toLocaleString('en-PK', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}
