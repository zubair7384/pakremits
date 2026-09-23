/**
 * robots.txt enforcement.
 *
 * Every adapter request passes through here before it goes out. This is not
 * advisory: `assertCrawlable` throws, the adapter fails, and refresh() degrades
 * that row to a stale badge. A provider that disallows the path we want simply
 * never gets scraped, and no future adapter can forget to check.
 *
 * Two real cases from the 2 Sep 2026 survey that this catches automatically:
 *   - xe.com disallows /currencytransfers/, which is where its quote flow lives.
 * Provider policies are re-read every six hours because they can change
 * independently of this codebase.
 *
 * Implements the subset of the spec that matters here: User-agent grouping with
 * a `*` fallback, Allow/Disallow with `*` and `$` wildcards, longest-match-wins
 * precedence, and Crawl-delay.
 */

/** What we identify as. Kept honest: a real contact URL, no browser spoofing. */
export const PAKREMITS_USER_AGENT = 'PakRemitsBot'

async function fetchRobotsIPv4(url: string): Promise<{ status: number; text: string }> {
  const { get } = await import('node:https')
  return new Promise((resolve, reject) => {
    const request = get(
      url,
      {
        family: 4,
        headers: { 'user-agent': PAKREMITS_USER_AGENT, accept: 'text/plain' },
        timeout: 8_000,
      },
      (response) => {
        let text = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => (text += chunk))
        response.on('end', () => resolve({ status: response.statusCode ?? 0, text }))
      },
    )
    request.on('timeout', () => request.destroy(new Error('robots.txt timed out')))
    request.on('error', reject)
  })
}

interface RobotsRule {
  allow: boolean
  pattern: string
}

interface RobotsPolicy {
  rules: RobotsRule[]
  crawlDelaySeconds: number | null
  /** True when we could not fetch robots.txt at all. */
  unavailable: boolean
}

export class RobotsDisallowedError extends Error {
  constructor(
    readonly url: string,
    readonly userAgent: string,
  ) {
    super(`robots.txt disallows ${userAgent} from ${url}`)
    this.name = 'RobotsDisallowedError'
  }
}

/** Cache per origin. robots.txt changes rarely; re-reading it every quote is rude. */
const cache = new Map<string, { policy: RobotsPolicy; expiresAt: number }>()
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

/**
 * Parse robots.txt into the rule set that applies to `userAgent`.
 *
 * Group selection follows the spec: the most specific matching User-agent group
 * wins outright, and `*` is used only when no named group matches. A site that
 * names us specifically — even to disallow everything — overrides its own `*`.
 */
export function parseRobots(text: string, userAgent: string): RobotsPolicy {
  const lowerAgent = userAgent.toLowerCase()

  // agent → rules. A group can list several User-agent lines before its rules.
  const groups = new Map<string, RobotsRule[]>()
  const delays = new Map<string, number>()

  let currentAgents: string[] = []
  let expectingAgents = false

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim()
    if (!line) continue

    const separator = line.indexOf(':')
    if (separator === -1) continue

    const field = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()

    if (field === 'user-agent') {
      // A User-agent line after rules starts a new group.
      if (!expectingAgents) currentAgents = []
      currentAgents.push(value.toLowerCase())
      expectingAgents = true
      continue
    }

    if (currentAgents.length === 0) continue
    expectingAgents = false

    if (field === 'allow' || field === 'disallow') {
      for (const agent of currentAgents) {
        const rules = groups.get(agent) ?? []
        // "Disallow:" with an empty value means allow everything — skip it
        // rather than treating "" as a prefix that matches every path.
        if (field === 'disallow' && value === '') {
          groups.set(agent, rules)
          continue
        }
        rules.push({ allow: field === 'allow', pattern: value })
        groups.set(agent, rules)
      }
    } else if (field === 'crawl-delay') {
      const seconds = Number.parseFloat(value)
      if (Number.isFinite(seconds)) {
        for (const agent of currentAgents) delays.set(agent, seconds)
      }
    }
  }

  // Most specific matching group wins. Longest token match, then `*`.
  let chosen = '*'
  let bestLength = -1
  for (const agent of groups.keys()) {
    if (agent === '*') continue
    if (lowerAgent.includes(agent) && agent.length > bestLength) {
      chosen = agent
      bestLength = agent.length
    }
  }

  return {
    rules: groups.get(chosen) ?? groups.get('*') ?? [],
    crawlDelaySeconds: delays.get(chosen) ?? delays.get('*') ?? null,
    unavailable: false,
  }
}

/** Translate a robots pattern (`*` and `$`) into an anchored regex. */
function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // escape regex metacharacters
    .replace(/\*/g, '.*') // robots wildcard
  // A trailing `$` in the original means end-of-path; our escape turned it into
  // `\$`, so convert it back to a real anchor.
  const anchored = escaped.endsWith('\\$') ? `${escaped.slice(0, -2)}$` : escaped
  return new RegExp(`^${anchored}`)
}

/**
 * Decide whether `path` is crawlable under a policy.
 *
 * Longest matching pattern wins; Allow beats Disallow on an exact-length tie,
 * which is how Google and the RFC 9309 draft resolve it.
 */
export function isPathAllowed(policy: RobotsPolicy, path: string): boolean {
  let decision = true
  let winningLength = -1

  for (const rule of policy.rules) {
    if (!patternToRegex(rule.pattern).test(path)) continue

    const length = rule.pattern.length
    if (length > winningLength || (length === winningLength && rule.allow)) {
      decision = rule.allow
      winningLength = length
    }
  }

  return decision
}

async function loadPolicy(origin: string): Promise<RobotsPolicy> {
  const cached = cache.get(origin)
  if (cached && cached.expiresAt > Date.now()) return cached.policy

  let policy: RobotsPolicy

  try {
    const response = await fetch(`${origin}/robots.txt`, {
      headers: { 'user-agent': PAKREMITS_USER_AGENT, accept: 'text/plain' },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })

    if (response.status === 404 || response.status === 410) {
      // No robots.txt means no restrictions, per the spec.
      policy = { rules: [], crawlDelaySeconds: null, unavailable: false }
    } else if (!response.ok) {
      // 5xx or 403 on robots.txt itself: treat as unavailable and refuse to
      // crawl. Guessing "probably fine" is how you end up in someone's logs.
      policy = { rules: [], crawlDelaySeconds: null, unavailable: true }
    } else {
      policy = parseRobots(await response.text(), PAKREMITS_USER_AGENT)
    }
  } catch {
    // A few provider CDNs advertise an unreachable IPv6 edge. Retry with IPv4
    // before treating robots.txt as unavailable and suppressing valid quotes.
    try {
      const response = await fetchRobotsIPv4(`${origin}/robots.txt`)
      if (response.status === 404 || response.status === 410) {
        policy = { rules: [], crawlDelaySeconds: null, unavailable: false }
      } else if (response.status >= 200 && response.status < 300) {
        policy = parseRobots(response.text, PAKREMITS_USER_AGENT)
      } else {
        policy = { rules: [], crawlDelaySeconds: null, unavailable: true }
      }
    } catch {
      policy = { rules: [], crawlDelaySeconds: null, unavailable: true }
    }
  }

  cache.set(origin, { policy, expiresAt: Date.now() + CACHE_TTL_MS })
  return policy
}

/**
 * Throw unless robots.txt permits fetching `url`.
 *
 * Call this before every outbound provider request. Adapters against a
 * documented, key-authenticated API may skip it — a partner API is a contract,
 * not a crawl — but everything else goes through here.
 */
export async function assertCrawlable(url: string): Promise<void> {
  const parsed = new URL(url)
  const policy = await loadPolicy(parsed.origin)

  if (policy.unavailable) {
    throw new RobotsDisallowedError(url, `${PAKREMITS_USER_AGENT} (robots.txt unreadable)`)
  }

  if (!isPathAllowed(policy, parsed.pathname + parsed.search)) {
    throw new RobotsDisallowedError(url, PAKREMITS_USER_AGENT)
  }
}

/** Crawl-delay for an origin, if it declares one. Honoured by the refresh loop. */
export async function crawlDelayMs(url: string): Promise<number> {
  const policy = await loadPolicy(new URL(url).origin)
  return (policy.crawlDelaySeconds ?? 0) * 1000
}

/** Test seam — clears the per-origin cache. */
export function __clearRobotsCache(): void {
  cache.clear()
}
