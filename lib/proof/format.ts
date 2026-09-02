/**
 * PKR formatting for the proof numbers.
 *
 * Pakistan groups digits in the lakh/crore system — 1,20,00,000, not
 * 12,000,000 — but `Intl` does not give it to us: `en-PK` and `ur-PK` both
 * return Western grouping, and only `en-IN` produces the right shape. Rather
 * than label a Pakistani site's numbers with an Indian locale tag, the grouping
 * is done here explicitly.
 *
 * Note this is deliberately separate from `formatPkr` in lib/ranking/compute.ts,
 * which keeps Western grouping for the comparison table. The table shows
 * hundreds of thousands, where both conventions read the same; the proof strip
 * shows crores, where they do not.
 */

const LAKH = 100_000
const CRORE = 10_000_000

/**
 * Group digits Pakistani-style: the last three, then pairs.
 *
 * 12000000 → "1,20,00,000"
 */
export function groupPkr(value: number): string {
  const rounded = Math.round(Math.abs(value))
  const sign = value < 0 ? '-' : ''
  const digits = String(rounded)

  if (digits.length <= 3) return sign + digits

  const last3 = digits.slice(-3)
  const rest = digits.slice(0, -3)
  // Pairs, right to left: 12000 → "12,000" but 1200000 → "12,00,000".
  const paired = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')

  return `${sign}${paired},${last3}`
}

/** `₨ 1,20,00,000`. The canonical form for any proof figure. */
export function formatProofPkr(value: number): string {
  return `₨ ${groupPkr(value)}`
}

/**
 * The same amount in words: "1.2 crore", "8.5 lakh", "4,200".
 *
 * Shown alongside the grouped figure because a run of eight digits is hard to
 * size at a glance, and "crore" is how the amount would actually be said.
 * Below one lakh there is no unit worth using, so it falls back to grouping.
 */
export function formatPkrWords(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (abs >= CRORE) return `${sign}${trimZero(abs / CRORE)} crore`
  if (abs >= LAKH) return `${sign}${trimZero(abs / LAKH)} lakh`
  return `${sign}${groupPkr(abs)}`
}

/** One decimal place, but never a trailing ".0" — "1.2", "3", not "3.0". */
function trimZero(value: number): string {
  const fixed = value.toFixed(1)
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed
}

/**
 * Both forms together: `₨ 1,20,00,000 (1.2 crore)`.
 *
 * Only adds the parenthetical when it says something the digits do not, i.e.
 * from one lakh up.
 */
export function formatProofPkrFull(value: number): string {
  const grouped = formatProofPkr(value)
  return Math.abs(value) >= LAKH ? `${grouped} (${formatPkrWords(value)})` : grouped
}
