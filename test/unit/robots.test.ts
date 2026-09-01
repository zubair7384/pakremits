/**
 * robots.txt tests, run against the real files fetched from each provider on
 * 2 Sep 2026. The fixtures matter as much as the parser: they are the evidence
 * for why Xe and MoneyGram are excluded from the adapter roadmap.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BHEJO_USER_AGENT, isPathAllowed, parseRobots } from '@/lib/providers/robots'

const fixture = (host: string) =>
  readFileSync(join(__dirname, '../fixtures/robots', `${host}.txt`), 'utf8')

const check = (host: string, path: string, agent = BHEJO_USER_AGENT) =>
  isPathAllowed(parseRobots(fixture(host), agent), path)

describe('parseRobots — real provider files', () => {
  it('blocks the Xe money-transfer quote path', () => {
    // This is why there is no Xe adapter: the quote flow lives under
    // /currencytransfers/, which xe.com disallows for every user-agent.
    expect(check('www.xe.com', '/currencytransfers/quote')).toBe(false)
    expect(check('www.xe.com', '/fxwidgets/embed')).toBe(false)
  })

  it('still allows the Xe currency converter, which is not a send quote', () => {
    expect(check('www.xe.com', '/currencyconverter/convert/')).toBe(true)
  })

  it('blocks MoneyGram entirely for AI agents that name themselves', () => {
    // moneygram.com has an explicit `User-agent: ClaudeBot / Disallow: /` group
    // alongside ai-train=no. A named group beats the site's own `*` group.
    expect(check('www.moneygram.com', '/gb/en/send-money', 'ClaudeBot')).toBe(false)
    expect(check('www.moneygram.com', '/anything', 'GPTBot')).toBe(false)
  })

  it('applies MoneyGram’s wildcard group to our own agent', () => {
    // We are not ClaudeBot, so the `*` group applies: most paths are allowed,
    // but the operator's ai-train=no signal is why the roadmap excludes them.
    expect(check('www.moneygram.com', '/gb/en/send-money')).toBe(true)
    expect(check('www.moneygram.com', '/MGI/anything')).toBe(false)
  })

  it('allows WorldRemit’s public pages but not the account area', () => {
    expect(check('www.worldremit.com', '/en/gb')).toBe(true)
    expect(check('www.worldremit.com', '/account/settings')).toBe(false)
  })

  it('honours WorldRemit’s Allow overriding a broader Disallow', () => {
    // Allow: /account/login sits inside Disallow: /account/*, and the longer
    // matching pattern wins.
    expect(check('www.worldremit.com', '/account/login')).toBe(true)
  })

  it('allows Ria site-wide except the RSC prefetch duplicates', () => {
    expect(check('www.riamoneytransfer.com', '/en-gb/money-transfer/')).toBe(true)
    expect(check('www.riamoneytransfer.com', '/en-gb/page?_rsc=abc123')).toBe(false)
  })
})

describe('the gate does not block our own working adapters', () => {
  it('permits the Wise gateway pricing endpoint, which Wise explicitly allows', () => {
    // wise.com/robots.txt carries, verbatim:
    //   # Allow bots to access API endpoints
    //   Allow: *gateway*sourceCurrency=*
    // The Wise adapter's URL is affirmatively sanctioned rather than merely
    // unmentioned, which is why the check matches path *and* query string.
    const wise = parseRobots(fixture('wise.com'), BHEJO_USER_AGENT)
    expect(
      isPathAllowed(
        wise,
        '/gateway/v1/price?sourceAmount=500&sourceCurrency=GBP&targetCurrency=PKR',
      ),
    ).toBe(true)
  })

  it('still blocks the Wise paths that robots.txt disallows', () => {
    const wise = parseRobots(fixture('wise.com'), BHEJO_USER_AGENT)
    // Disallow: /*/*/currency-converter/ — two segments must precede it, so
    // a locale+language path matches and a bare locale path does not.
    expect(isPathAllowed(wise, '/gb/en/currency-converter/gbp-to-pkr-rate')).toBe(false)
    expect(isPathAllowed(wise, '/gb/currency-converter/gbp-to-pkr-rate')).toBe(true)
    expect(isPathAllowed(wise, '/widget')).toBe(false)
    expect(isPathAllowed(wise, '/visit/anything')).toBe(false)
  })
})

describe('parseRobots — spec behaviour', () => {
  it('treats an empty Disallow as allow-all', () => {
    // Small World ships exactly this: "User-agent: *\nDisallow:"
    const policy = parseRobots('User-agent: *\nDisallow:', BHEJO_USER_AGENT)
    expect(isPathAllowed(policy, '/anything')).toBe(true)
  })

  it('treats Disallow: / as block-all', () => {
    const policy = parseRobots('User-agent: *\nDisallow: /', BHEJO_USER_AGENT)
    expect(isPathAllowed(policy, '/')).toBe(false)
    expect(isPathAllowed(policy, '/anything')).toBe(false)
  })

  it('allows everything when there are no rules', () => {
    expect(isPathAllowed(parseRobots('', BHEJO_USER_AGENT), '/x')).toBe(true)
  })

  it('supports * wildcards mid-pattern', () => {
    const policy = parseRobots('User-agent: *\nDisallow: /a/*/secret', BHEJO_USER_AGENT)
    expect(isPathAllowed(policy, '/a/b/secret')).toBe(false)
    expect(isPathAllowed(policy, '/a/b/public')).toBe(true)
  })

  it('supports the $ end-anchor', () => {
    const policy = parseRobots('User-agent: *\nDisallow: /*.pdf$', BHEJO_USER_AGENT)
    expect(isPathAllowed(policy, '/report.pdf')).toBe(false)
    expect(isPathAllowed(policy, '/report.pdf.html')).toBe(true)
  })

  it('resolves ties in favour of Allow', () => {
    const policy = parseRobots('User-agent: *\nDisallow: /x\nAllow: /x', BHEJO_USER_AGENT)
    expect(isPathAllowed(policy, '/x')).toBe(true)
  })

  it('lets the longest matching pattern win regardless of order', () => {
    const policy = parseRobots(
      'User-agent: *\nAllow: /a/b/c\nDisallow: /a/',
      BHEJO_USER_AGENT,
    )
    expect(isPathAllowed(policy, '/a/b/c')).toBe(true)
    expect(isPathAllowed(policy, '/a/b')).toBe(false)
  })

  it('prefers a named group over the wildcard group', () => {
    const text = 'User-agent: *\nDisallow:\n\nUser-agent: BhejoBot\nDisallow: /'
    expect(isPathAllowed(parseRobots(text, 'BhejoBot'), '/x')).toBe(false)
    expect(isPathAllowed(parseRobots(text, 'SomeoneElse'), '/x')).toBe(true)
  })

  it('handles several User-agent lines sharing one rule block', () => {
    const text = 'User-agent: A\nUser-agent: B\nDisallow: /blocked'
    expect(isPathAllowed(parseRobots(text, 'A'), '/blocked')).toBe(false)
    expect(isPathAllowed(parseRobots(text, 'B'), '/blocked')).toBe(false)
  })

  it('starts a new group when User-agent follows a rule', () => {
    const text = 'User-agent: A\nDisallow: /a\nUser-agent: B\nDisallow: /b'
    expect(isPathAllowed(parseRobots(text, 'A'), '/b')).toBe(true)
    expect(isPathAllowed(parseRobots(text, 'B'), '/a')).toBe(true)
    expect(isPathAllowed(parseRobots(text, 'B'), '/b')).toBe(false)
  })

  it('ignores comments and blank lines', () => {
    const text = '# comment\n\nUser-agent: *  # trailing\nDisallow: /x # why\n'
    expect(isPathAllowed(parseRobots(text, BHEJO_USER_AGENT), '/x')).toBe(false)
  })

  it('reads Crawl-delay', () => {
    // MoneyGram sets Crawl-delay: 5 for everyone.
    expect(parseRobots(fixture('www.moneygram.com'), BHEJO_USER_AGENT).crawlDelaySeconds).toBe(5)
  })
})
