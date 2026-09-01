/**
 * Environment loading for scripts and drizzle-kit.
 *
 * Next.js reads `.env.local` automatically, but `tsx` and `drizzle-kit` do not —
 * `import 'dotenv/config'` only picks up `.env`. Importing this module first
 * gives CLI tooling the same precedence the app has.
 *
 * dotenv does not overwrite variables that are already set, so the order below
 * means: real environment > .env.local > .env.
 */
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })
