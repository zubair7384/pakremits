import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET as confirm } from '@/app/alerts/confirm/[token]/route'
import { GET as unsubscribe } from '@/app/alerts/unsubscribe/[token]/route'

afterEach(() => vi.unstubAllEnvs())

describe('alert redirects behind Fly', () => {
  it('uses the public hostname for a confirmation error', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://stage.pakremits.com')
    const response = await confirm(new Request('http://0.0.0.0:3000/alerts/confirm/bad'), {
      params: Promise.resolve({ token: 'bad' }),
    })
    expect(response.headers.get('location')).toBe('https://stage.pakremits.com/?alert=invalid')
  })

  it('uses the public hostname for an unsubscribe error', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://stage.pakremits.com')
    const response = await unsubscribe(new Request('http://0.0.0.0:3000/alerts/unsubscribe/bad'), {
      params: Promise.resolve({ token: 'bad' }),
    })
    expect(response.headers.get('location')).toBe('https://stage.pakremits.com/?alert=invalid')
  })
})
