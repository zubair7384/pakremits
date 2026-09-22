import { afterEach, describe, expect, it, vi } from 'vitest'
import { notifierFor } from '@/lib/notify'

afterEach(() => vi.unstubAllEnvs())

describe('notification delivery configuration', () => {
  it('fails closed in production when email credentials are absent', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('RESEND_FROM', '')
    expect(notifierFor('email').name).toBe('resend')
  })

  it('allows simulated sends for local development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('RESEND_FROM', '')
    expect(notifierFor('email').name).toBe('console')
  })
})
