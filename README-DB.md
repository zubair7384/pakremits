# PakRemits — database and CI bundle

Schema, migrations, seed scripts, and the GitHub Actions refresh workflow.
This repository contains no production data or credentials.

## Included files

- `drizzle/` — migrations `0000`–`0004` plus Drizzle Kit metadata and snapshots
- `lib/db/schema.ts` — the Drizzle schema and source of truth
- `lib/db/index.ts` — the PostgreSQL client and `toNum()` numeric boundary helper
- `drizzle.config.ts` — Drizzle Kit configuration
- `scripts/seed.ts` and `scripts/seed-proof-demo.ts` — synthetic seed data
- `scripts/refresh-local.ts` — local rate refresh entry point
- `.env.example` — environment template containing placeholders only
- `.github/workflows/refresh-rates.yml` — scheduled rate refresh workflow

## Set up a database

1. Create a PostgreSQL database in Supabase or run PostgreSQL locally.
2. Copy `.env.example` to `.env.local` and set `DATABASE_URL` and `DIRECT_URL`.
   Use the direct connection on port 5432 for `DIRECT_URL`; DDL is unreliable
   through a transaction pooler on port 6543.
3. Apply all migrations in order:

   ```bash
   npm run db:migrate
   ```

4. Populate the database with synthetic starter data:

   ```bash
   npm run seed
   ```

5. Fetch current rates:

   ```bash
   npm run refresh
   ```

The local application reads rates from PostgreSQL. Cloning the repository or
extracting the schema archive does not provide the live data another developer
sees; developers must connect to the same database if they need identical data.

## Schema notes

- Sending-currency amounts use `numeric(14,2)`.
- PKR amounts use `numeric(18,2)`.
- Rates use `numeric(18,6)`.
- Drizzle returns PostgreSQL `numeric` values as strings. Parse them at the
  application boundary with `toNum()` rather than relying on implicit coercion.
- Migrations `0001_rls.sql` and `0004_proof_rls.sql` configure row-level
  security. Apply migrations in order and do not skip them.
- `rate_alerts` contains subscriber contact details in production. The project
  and seed scripts contain no live subscriber data.

## GitHub Actions refresh

`.github/workflows/refresh-rates.yml` runs at 7, 22, 37, and 52 minutes past
each hour and then asks the deployed site to discard cached quote data. It runs
the refresh directly because the complete job takes longer than a typical web
function request and may need Chromium for browser-based adapters.

Configure these values under **Settings → Secrets and variables → Actions**:

| Kind | Name | Notes |
| --- | --- | --- |
| Secret | `DATABASE_URL` | Pooled connection to your database |
| Secret | `CRON_SECRET` | Must match the deployment value |
| Variable | `SITE_URL` | Leave unset to skip cache revalidation |
| Variable | `BHEJO_DISABLED_ADAPTERS` | Optional comma-separated adapter list |

The workflow uses `concurrency.cancel-in-progress: false`, so a slow refresh
queues the following run instead of allowing two jobs to write concurrently.
