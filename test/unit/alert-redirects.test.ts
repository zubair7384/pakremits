import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET as confirm } from '@/app/alerts/confirm/[token]/route'
import { GET as unsubscribe, POST as unsubscribePost } from '@/app/alerts/unsubscribe/[token]/route'

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

  it('opens a confirmation page without deleting when a valid link is followed', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://stage.pakremits.com')
    const token = 'a'.repeat(43)
    const response = await unsubscribe(new Request(`http://0.0.0.0:3000/alerts/unsubscribe/${token}`), {
      params: Promise.resolve({ token }),
    })
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(`https://stage.pakremits.com/alerts/unsubscribe/${token}/confirm`)
  })

  it('requires an explicit browser confirmation or inbox one-click POST', async () => {
    const token = 'a'.repeat(43)
    const response = await unsubscribePost(new Request(`http://localhost:3000/alerts/unsubscribe/${token}`, {
      method: 'POST',
      body: 'unrelated=1',
    }), { params: Promise.resolve({ token }) })
    expect(response.status).toBe(400)
  })
})
