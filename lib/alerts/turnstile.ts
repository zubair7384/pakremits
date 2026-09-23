/** Turnstile tokens are short-lived and single-use. Always verify at signup. */
export async function verifyTurnstile(token: string, hostname: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY ||
    (process.env.NODE_ENV !== 'production' ? '1x0000000000000000000000000000000AA' : undefined)
  if (!secret || !token) return false

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    })
    if (!response.ok) return false
    const result = (await response.json()) as { success?: boolean; hostname?: string }
    return result.success === true && result.hostname === hostname
  } catch {
    return false
  }
}
