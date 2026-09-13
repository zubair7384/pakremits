import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Process-level liveness check for deployment platforms and load balancers.
 * It deliberately avoids PostgreSQL and provider APIs: a dependency outage
 * should be visible in monitoring without causing Fly to restart a healthy
 * application process.
 */
export function GET() {
  return NextResponse.json(
    { ok: true, service: 'pakremits' },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
