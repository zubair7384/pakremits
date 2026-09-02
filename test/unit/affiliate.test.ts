/**
 * Affiliate template tests.
 *
 * A wrong template fails silently — the redirect still works and the user
 * still reaches the provider, the commission just never arrives. Nothing about
 * it is visible without these checks.
 */
import { describe, expect, it } from 'vitest'
import { buildAffiliateUrl, validateAffiliateTemplate } from '@/lib/admin/affiliate'

describe('validateAffiliateTemplate', () => {
  it('accepts an empty template, the correct pre-approval state', () => {
    expect(validateAffiliateTemplate('')).toEqual({ ok: true })
    expect(validateAffiliateTemplate('   ')).toEqual({ ok: true })
  })

  it('accepts a real Impact template', () => {
    const template =
      'https://wise.prf.hn/click/camref:1011l123/destination:{destination}?subId1={clickId}'
    expect(validateAffiliateTemplate(template)).toEqual({ ok: true })
  })

  it('accepts a real CJ template', () => {
    const template = 'https://www.anrdoezrs.net/click-1234-5678?url={destination}&sid={clickId}'
    expect(validateAffiliateTemplate(template)).toEqual({ ok: true })
  })

  it('rejects a template with no {clickId} — the silent revenue bug', () => {
    const result = validateAffiliateTemplate('https://wise.prf.hn/click/camref:1011l123')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('attributed')
  })

  it('rejects a relative URL, which would redirect back into our own site', () => {
    expect(validateAffiliateTemplate('/go/wise?subId1={clickId}').ok).toBe(false)
  })

  it('rejects http, which would downgrade the click', () => {
    expect(validateAffiliateTemplate('http://wise.prf.hn/click?sid={clickId}').ok).toBe(false)
  })

  it('rejects outright nonsense', () => {
    expect(validateAffiliateTemplate('not a url at all {clickId}').ok).toBe(false)
  })
})

describe('buildAffiliateUrl', () => {
  const homepageUrl = 'https://wise.com'
  const clickId = '8d1fffa4-ccac-418f-a929-8fa67fbb0b84'

  it('falls back to the homepage when there is no template', () => {
    expect(buildAffiliateUrl({ template: null, homepageUrl, clickId })).toBe(homepageUrl)
  })

  it('substitutes both placeholders', () => {
    const url = buildAffiliateUrl({
      template: 'https://wise.prf.hn/click/camref:X/destination:{destination}?subId1={clickId}',
      homepageUrl,
      clickId,
    })
    expect(url).toBe(
      `https://wise.prf.hn/click/camref:X/destination:https%3A%2F%2Fwise.com?subId1=${clickId}`,
    )
  })

  it('URL-encodes the destination so the redirect is not truncated', () => {
    // Left raw, the ? and & of a destination would terminate the network's own
    // query string and the click would land somewhere unintended.
    const url = buildAffiliateUrl({
      template: 'https://cj.example/click?url={destination}&sid={clickId}',
      homepageUrl: 'https://provider.example/signup?a=1&b=2',
      clickId,
    })
    expect(url).toContain('url=https%3A%2F%2Fprovider.example%2Fsignup%3Fa%3D1%26b%3D2')
    expect(url.split('&').length).toBe(2)
  })

  it('replaces every occurrence, not just the first', () => {
    const url = buildAffiliateUrl({
      template: 'https://n.example/{clickId}/go?sid={clickId}&u={destination}',
      homepageUrl,
      clickId,
    })
    expect(url.match(new RegExp(clickId, 'g'))).toHaveLength(2)
  })
})
