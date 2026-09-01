import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

declare global {
  // eslint-disable-next-line no-var
  var __bhejoSql: ReturnType<typeof postgres> | undefined
}

function createClient() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local.')

  return postgres(url, {
    // Supabase's pooler runs in transaction mode, which cannot hold prepared
    // statements across checkouts. Without this every query fails after the first.
    prepare: false,
    // Serverless invocations are short-lived; a big pool just exhausts Supabase.
    max: process.env.NODE_ENV === 'production' ? 1 : 5,
    idle_timeout: 20,
  })
}

let cached: ReturnType<typeof drizzle<typeof schema>> | undefined

/**
 * Connect on first query, not on import.
 *
 * Modules that merely *reference* the db — route handlers, the refresh loop —
 * get imported during `next build` and by unit tests that never touch Postgres.
 * Connecting eagerly would make both fail on a missing DATABASE_URL.
 */
export function getDb() {
  if (!cached) {
    // Reuse across hot reloads in dev, otherwise each save leaks a connection.
    const sql = globalThis.__bhejoSql ?? createClient()
    if (process.env.NODE_ENV !== 'production') globalThis.__bhejoSql = sql
    cached = drizzle(sql, { schema })
  }
  return cached
}

/**
 * Ergonomic handle: `db.select()` works as usual, but the connection is only
 * opened when a property is actually read.
 */
export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get: (_target, prop, receiver) => Reflect.get(getDb(), prop, receiver),
})

export { schema }

/**
 * Parse a Drizzle `numeric` column (returned as a string) into a number.
 *
 * Safe for our ranges: the largest value we store is a PKR amount around
 * 10^6 with 2 decimals, far inside the 2^53 exact-integer window.
 */
export function toNum(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'number' ? value : Number.parseFloat(value)
  if (!Number.isFinite(n)) throw new Error(`Expected a numeric value, got ${value}`)
  return n
}
