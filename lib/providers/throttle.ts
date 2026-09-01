/**
 * Per-host request throttling.
 *
 * The refresh loop runs adapters in parallel within a slot, which meant two
 * providers were fine but a single provider serving several corridors got
 * bursts. Remitly answered with HTTP 429 during the first full local refresh.
 *
 * This serialises requests per host and enforces a minimum gap between them, so
 * we are never making two concurrent requests to the same provider regardless
 * of how the caller is structured. Being throttled is not just impolite — a
 * 429 is a provider telling us we are a problem.
 */

/** Tail of the promise chain per host. Awaiting it means waiting your turn. */
const chains = new Map<string, Promise<void>>()

/** Default gap between requests to one host. */
const DEFAULT_MIN_INTERVAL_MS = 1_200

/** Hosts that need a longer leash, learned from their 429s. */
const HOST_INTERVALS: Record<string, number> = {
  'api.remitly.io': 2_000,
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wait until it is safe to make a request to `host`.
 *
 * Returns a promise that resolves when the caller may proceed. Calls queue in
 * arrival order; each waits `minInterval` after the previous one started.
 *
 * A jitter of ±25% keeps us from producing a perfectly periodic request train,
 * which is both easier to fingerprint and worse for the provider's own caches.
 */
export async function throttleHost(host: string, crawlDelayMs = 0): Promise<void> {
  const base = HOST_INTERVALS[host] ?? DEFAULT_MIN_INTERVAL_MS
  // A robots.txt Crawl-delay is a stated preference and always wins if longer.
  const interval = Math.max(base, crawlDelayMs)

  const previous = chains.get(host) ?? Promise.resolve()

  const current = previous.then(async () => {
    const jitter = interval * (0.75 + Math.random() * 0.5)
    await sleep(jitter)
  })

  // Swallow rejections so one failure cannot poison the queue for a host.
  chains.set(
    host,
    current.catch(() => {}),
  )

  await current
}

/** Test seam. */
export function __resetThrottle(): void {
  chains.clear()
}
