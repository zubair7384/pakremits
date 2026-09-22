import { afterEach, describe, expect, it, vi } from 'vitest'
import { verifyTurnstile } from '@/lib/alerts/turnstile'

afterEach(() => vi.unstubAllGlobals())

describe('Turnstile signup verification', () => {
  it('accepts only a successful token for this site', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, hostname: 'stage.pakremits.com' }),
    }))
    expect(await verifyTurnstile('token', 'stage.pakremits.com')).toBe(true)
    expect(await verifyTurnstile('token', 'pakremits.com')).toBe(false)
  })

  it('fails closed on validation errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')))
    expect(await verifyTurnstile('token', 'stage.pakremits.com')).toBe(false)
    expect(await verifyTurnstile('', 'stage.pakremits.com')).toBe(false)
  })
})
