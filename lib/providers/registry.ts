/**
 * The adapter registry.
 *
 * Adding a provider is: write the adapter, import it here, add a row to the
 * seed. Nothing else in the codebase needs to know it exists.
 *
 * `BHEJO_DISABLED_ADAPTERS` is a comma-separated kill switch — if a provider
 * asks us to stop, or an endpoint starts misbehaving in production, one env var
 * change takes it out of the rotation without a deploy.
 */
import { botimAdapter } from './http/botim'
import { careemAdapter } from './http/careem'
import { remitlyAdapter } from './http/remitly'
import { wiseAdapter } from './http/wise'
import type { ProviderAdapter, QuoteRequest } from './types'

/**
 * Priority order. When two providers tie on amount received the ranking breaks
 * the tie on speed, not on this list — order here only affects refresh order.
 */
const ALL_ADAPTERS: readonly ProviderAdapter[] = [
  wiseAdapter,
  remitlyAdapter,
  careemAdapter,
  botimAdapter,
  // Tier B (site XHR APIs) — endpoints probed, adapters pending:
  //   worldremit, xe, paysend, taptap-send, western-union, ria, moneygram, small-world
  // Tier C (Playwright, GitHub Actions only):
  //   ace, lycaremit
  // Tier D (manual via /admin/quotes): sadapay, nayapay, typical-bank benchmark
]

function disabledSlugs(): Set<string> {
  return new Set(
    (process.env.BHEJO_DISABLED_ADAPTERS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
}

/**
 * Adapters available in the current runtime.
 *
 * Vercel functions have no Chromium, so browser adapters are filtered out there
 * and only run in the GitHub Actions job, which sets `BHEJO_ALLOW_BROWSER=1`.
 */
export function activeAdapters(): ProviderAdapter[] {
  const disabled = disabledSlugs()
  const allowBrowser = process.env.BHEJO_ALLOW_BROWSER === '1'

  return ALL_ADAPTERS.filter(
    (a) => !disabled.has(a.slug) && (a.runtime === 'http' || allowBrowser),
  )
}

/** Adapters that can answer this specific corridor + method combination. */
export function adaptersFor(request: QuoteRequest): ProviderAdapter[] {
  return activeAdapters().filter((a) => a.supports(request))
}

export function adapterBySlug(slug: string): ProviderAdapter | undefined {
  return ALL_ADAPTERS.find((a) => a.slug === slug)
}

export { ALL_ADAPTERS }
