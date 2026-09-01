import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * HTTP Basic auth over /admin, checked against a single ADMIN_PASSWORD.
 *
 * Basic auth keeps this to one file with no session table, no login page, and
 * no cookie to leak. The username is ignored — only the password is checked.
 *
 * Note: this runs on the Edge runtime — Next 16's `proxy` convention, which
 * replaced `middleware` — so it uses a hand-rolled constant-time compare rather
 * than node:crypto's timingSafeEqual.
 */
export const config = { matcher: ['/admin/:path*'] }

function unauthorised() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Bhejo admin", charset="UTF-8"' },
  })
}

/** Constant-time string compare that does not leak length via early exit. */
function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const ab = encoder.encode(a)
  const bb = encoder.encode(b)
  if (ab.length !== bb.length) return false

  let diff = 0
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i]
  return diff === 0
}

export default function proxy(request: NextRequest) {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) {
    console.error('[admin] ADMIN_PASSWORD is not set — locking /admin')
    return unauthorised()
  }

  const header = request.headers.get('authorization')
  if (!header?.startsWith('Basic ')) return unauthorised()

  let decoded: string
  try {
    decoded = atob(header.slice('Basic '.length))
  } catch {
    return unauthorised()
  }

  // "user:password" — everything after the first colon is the password.
  const password = decoded.slice(decoded.indexOf(':') + 1)
  if (!safeEqual(password, expected)) return unauthorised()

  return NextResponse.next()
}
