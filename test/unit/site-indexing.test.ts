import { afterEach, describe, expect, it, vi } from 'vitest'
import robots from '@/app/robots'
import { searchIndexingEnabled } from '@/lib/seo'

afterEach(() => vi.unstubAllEnvs())

describe('site crawler policy', () => {
  it('blocks every crawler when indexing has not been enabled', () => {
    vi.stubEnv('ROBOTS_ALLOW_INDEXING', 'false')
    expect(searchIndexingEnabled()).toBe(false)
    expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } })
  })

  it('advertises the sitemap only after the production switch', () => {
    vi.stubEnv('ROBOTS_ALLOW_INDEXING', 'true')
    expect(searchIndexingEnabled()).toBe(true)
    const policy = robots()
    expect(policy.rules).toMatchObject([{ userAgent: '*', allow: '/' }])
    expect(policy.sitemap).toBe('http://localhost:3000/sitemap.xml')
  })
})
