# Bhejo — بھیجو

Compares money-transfer services sending to Pakistan, ranked by the exact PKR
amount that lands in the recipient's account. Not by rate, not by fee, not by
who pays us.

**Status: Phases 1–4 complete.** The rate engine runs against live provider
APIs and the full public site renders from it — home, 8 corridor pages, 8 rate
pages, provider and head-to-head pages, method pages, and the static set, in
English and Urdu. 26 pages prerender.

Phase 5 (the launch checklist: Playwright e2e, Lighthouse, accessibility pass) is
not built. Two of the fourteen providers in the original brief are live; see
[Provider access](#provider-access-as-surveyed-on-2-sep-2026) for why the rest
are not, which is the main open question for the project.

---

## What works today

```
npm run probe
```

```
Probing GBP → PKR, bank, 500 GBP
  mid-market: 375.114 (wise)

  provider   rate       fee     received        note
  Wise       375.1140   3.66    ₨ 186,184.08    205ms · In hours · markup 0.00%
  Remitly    377.1200   0.00    ₨ 188,560       757ms · 3–5 days · promo · markup -0.53%
```

- Two live adapters (Wise, Remitly) across all eight corridors, no API keys.
- Home page rendering live quotes, with the interactive comparison panel.
- Affiliate redirects at `/go/[provider]` logging clicks.
- robots.txt enforced on every outbound adapter request.
- Mid-market rates and 30-day history from Wise's public rates endpoints.
- `computeReceived` and the ranking rules, with 76 unit tests.
- Cron refresh endpoint plus a GitHub Actions schedule.
- Password-protected manual quote override at `/admin/quotes`.
- Rate alerts: double opt-in email, WhatsApp/SMS behind a swappable notifier,
  12-hour rate limiting, weekly digest, one-click unsubscribe that deletes.
- `/admin` dashboard: clicks by provider and corridor, alert volumes, adapter
  freshness, cron run history, and affiliate template management.

### Alerts without a Resend or Twilio account

`lib/notify/` falls back to a console notifier whenever credentials are absent,
so the entire pipeline — evaluation, rate limiting, message composition, trigger
recording — runs locally and prints the messages it would have sent. Sends are
marked `simulated`, and a trigger is still recorded, otherwise a local run would
re-fire the same alert every 15 minutes.

**Alerts trigger on the best rate actually obtainable, not the mid-market rate.**
Nobody can get the mid-market rate, so an alert firing when it crosses 380 would
tell the recipient to act on a number they cannot have — and the message would
then have to read "crossed 380, best available 378.90". If no provider quote
exists for a corridor we do not fall back to mid-market; we simply do not fire.

---

## Local setup

Requires Node 20+ (or 22+; Node 23 works but emits engine warnings from eslint).

```bash
git clone <your-repo> bhejo && cd bhejo
npm install
cp .env.example .env.local
```

### Supabase

1. Create a project at [supabase.com](https://supabase.com) — the free tier is enough.
2. **Project Settings → Database → Connection string**. Copy two URLs into `.env.local`:
   - `DATABASE_URL` — the **Transaction** pooler URL (port `6543`). Used at runtime.
   - `DIRECT_URL` — the **Session** URL (port `5432`). Used only for migrations,
     because the pooler cannot run DDL transactions reliably.
3. Apply the schema and the RLS policies:

```bash
npm run db:migrate
```

`0001_rls.sql` enables row-level security with no policies, which closes
Supabase's auto-generated REST API. Without it, the `rate_alerts` table — email
addresses and phone numbers — would be readable by anyone with the anon key.

### Seed and first refresh

```bash
npm run seed      # providers, corridors, 30 days of mid-market history
npm run refresh   # walks the full grid and writes live quotes
```

The seed pulls real 30-day history from Wise. If that call fails it writes a
deterministic synthetic walk marked `source: 'synthetic'`, so the charts render
on a fresh deploy and the fake data is trivially identifiable.

### Run it

```bash
npm run dev
```

- `/admin/quotes` — HTTP Basic auth, any username, `ADMIN_PASSWORD` as password.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm test` | Unit tests (compute, ranking, adapter parsers) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run probe` | Call every adapter live and print a comparison table |
| `npm run probe -- --from AED --amount 3000 --method wallet` | Probe one corridor |
| `npm run probe -- --save` | Re-capture test fixtures from live responses |
| `npm run refresh` | Full refresh locally, bypassing the HTTP route |
| `npm run seed` | Idempotent seed |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Drizzle Studio |

### URLs

Public URLs do not match the file router, for two reasons documented in
`next.config.ts`: Next dynamic segments must be a whole path segment (so
`send-money-from-[slug]-to-pakistan` is not expressible as a folder), and
English is served unprefixed while pages live under `/[locale]`. Both are
handled by explicit rewrites.

**Never link an internal path directly.** `robots.txt` disallows `/corridor/`,
`/rate/` and `/method/`, so a stray internal link would point search engines at
a de-indexed URL. Every link goes through `lib/routes.ts`, which takes a locale
so Urdu pages link to Urdu pages. Adding a page means adding a rewrite line.

---

## Deploying to Vercel

1. Push to GitHub, import the repo at [vercel.com/new](https://vercel.com/new).
2. Add every variable from `.env.example` under **Settings → Environment Variables**.
3. Deploy.

### The cron is not on Vercel

Vercel's Hobby plan **caps cron jobs at once per day** and rejects any more
frequent expression at deploy time
([docs](https://vercel.com/docs/cron-jobs/usage-and-pricing)). A 15-minute
refresh therefore runs from GitHub Actions instead, which also gives us a place
to run Playwright adapters later — Vercel functions have no Chromium.

The job also does not call the site over HTTP. A full refresh across the grid
takes about four minutes with polite per-host throttling, well past the 60s
function limit, so `.github/workflows/refresh-rates.yml` runs `npm run refresh`
directly against the database and then pings `/api/cron/revalidate` to drop the
cached pages. `/api/cron/refresh-rates` still exists for manual triggering.

In your GitHub repo:

- **Settings → Secrets and variables → Actions → Secrets**: add `DATABASE_URL`
  (the pooled Supabase URL) and `CRON_SECRET`, matching the value in Vercel.
- **→ Variables**: add `SITE_URL`, e.g. `https://bhejo.vercel.app`. Leave it
  unset before the first deploy and the revalidate step skips itself.

Trigger the workflow by hand from the Actions tab to check it before waiting for
a tick. GitHub's scheduler is best-effort and lags under load, which is why
`/admin` surfaces the last successful run.

---

## The admin area

Three pages behind HTTP Basic auth (any username, `ADMIN_PASSWORD` as the
password):

| Page | What it is for |
| --- | --- |
| `/admin` | Clicks by provider and corridor, alert volumes, adapter freshness, cron history |
| `/admin/providers` | Affiliate templates and the sponsored placement |
| `/admin/quotes` | Manual quote overrides |

The dashboard's loudest signal is the banner that appears when no refresh has
run in 45 minutes. It is worth trusting: the schedule is GitHub's, which is
best-effort and does stop, and nothing else on the site would tell you — a
stale quote still renders a number.

### Setting an affiliate template

Paste the network's tracking URL into `/admin/providers` with two placeholders:

- `{clickId}` — becomes the `click_id` of the row written to `affiliate_clicks`,
  which is what lets a conversion the network reports later be traced back to
  the corridor and amount that produced it. **A template without it is rejected**,
  because the click would still work and simply never earn anything.
- `{destination}` — the provider's homepage, URL-encoded.

A provider with no template still links to its homepage. That is the correct
state before a programme is approved, not a broken link, and the dashboard
counts how many clicks it cost you.

### Sponsored placement

One provider at a time can be featured. It is pinned directly below the best
deal, never above, always carries a visible **Sponsored** label, and can never
take the gold **Best deal** highlight. `test/unit/rank.test.ts` fails if
sponsorship ever changes which row is best — the ranking function has no
commission input at all, so this cannot be weakened without a visible code
change.

---

## Adding a provider adapter

1. **Probe the site first.** Open the provider's calculator with devtools on the
   Network tab, filter to XHR, and change the amount. Most of these sites call a
   JSON endpoint you can call directly.
2. `curl` that endpoint. If it fails, add `origin` and `referer` headers for the
   provider's own domain — Remitly returns `{"error_key":"NOT_ALLOWED"}` with
   HTTP 200 without them.
3. Save the response to `test/fixtures/<slug>-gbp-pkr-500.json`.
4. Create `lib/providers/http/<slug>.ts`. Export a pure `parse<Slug>(payload,
   request): Quote` function and an adapter object implementing `ProviderAdapter`.
5. Set `feeModel` correctly. `deducted` means the fee comes out of the amount
   (Wise). `additional` means it is charged on top (Remitly). Getting this wrong
   silently biases the whole table.
6. Fill `supports()` honestly — only the rails the provider actually pays out to.
7. Set `deliverySpeedMinutes` from the provider's published SLA, and leave a
   comment saying it is an SLA rather than live data.
8. Add the adapter to `ALL_ADAPTERS` in `lib/providers/registry.ts`.
9. Add a row to `PROVIDERS` in `scripts/seed.ts` with brand colour and capability flags.
10. Write parser tests in `test/unit/adapters.test.ts` against your fixture:
    the happy path, a malformed payload, and an unsupported delivery method.

Then `npm run probe` to see it live, and `npm run seed` to create its row.

For a provider with no JSON endpoint, set `runtime: 'browser'` and put the
adapter in `lib/providers/browser/`. Those are skipped on Vercel and only run in
the GitHub Actions job, which sets `BHEJO_ALLOW_BROWSER=1`.

If a provider asks us to stop, add its slug to `BHEJO_DISABLED_ADAPTERS` — it
leaves the rotation immediately with no deploy.

---

## Provider access, as surveyed on 2 Sep 2026

Every provider in the original brief was checked against two gates: what its
`robots.txt` permits, and whether the quote flow sits behind bot protection.
The result is that **the 14-provider target is not reachable by scraping.**

### Live

| Provider | robots.txt | Bot protection |
| --- | --- | --- |
| **Wise** | Explicitly *allows* it: `Allow: *gateway*sourceCurrency=*` | None |
| **Remitly** | No `robots.txt` on `api.remitly.io` (404 → unrestricted) | None |

### Buildable, not yet written

| Provider | Notes |
| --- | --- |
| Ria | `Allow: /`, no bot protection. The calculator is server-rendered — no quote XHR exists — so this is an HTML parse of an allowed page. Corridor URL still to be pinned down. |
| Small World | `Disallow:` (allow-all), but returns 403 to a plain fetch. Likely geo or UA gating; worth a second look. |
| ACE Money Transfer | robots only excludes `/?utm=` and `/cdn-cgi/`. Also 403 to a plain fetch. |
| Paysend | No `robots.txt` at all. Server-rendered; needs URL discovery. |
| Taptap Send | Mobile-app API. Returns `BAD_HEADER` without app headers I do not have. |

### Excluded, and why

| Provider | Reason |
| --- | --- |
| **Xe** | `robots.txt` disallows `/currencytransfers/` — which is exactly where the money-transfer quote flow lives. The currency *converter* is allowed, but that is a mid-market rate, not a send quote. |
| **MoneyGram** | `robots.txt` names AI agents individually and disallows them site-wide, sets `Content-Signal: ai-train=no, use=reference`, and applies `Crawl-delay: 5`. The operator has opted out explicitly. |
| **WorldRemit** | PerimeterX. GraphQL introspection is disabled and the API requires a bot-detection token. |
| **Western Union** | Akamai bot protection. |
| **Lycaremit** | Cloudflare challenge. |

The last three are excluded on a rule, not a difficulty judgement: getting quotes
from them means defeating bot detection, and this project does not do that. The
legitimate routes to those providers are, in order of preference:

1. **Affiliate network data feeds.** Impact and CJ often expose a product/rate
   feed to approved publishers. This is the intended path and needs no scraping.
2. **A partner API.** Wise, Western Union, and MoneyGram all run partner
   programmes with real quote APIs behind a credential.
3. **Manual entry** via `/admin/quotes`, refreshed on whatever cadence is
   practical, clearly marked `source: 'manual'` and timestamped on the page.

Until one of those lands, showing 14 providers is not achievable — the design's
"14 providers checked" line and the `stats` panel should read from the live
count rather than a constant.

Wise's *documented* quote API (`POST /v3/quotes`) is not anonymous either: the
"unauthenticated quote" still needs a client-credentials token from a Wise
Platform partner account. The gateway pricing endpoint above needs nothing, and
Wise's own `robots.txt` invites bots to use it.

### robots.txt is enforced in code

`lib/providers/robots.ts` gates every outbound adapter request. It is not
advisory — a disallowed path throws, the adapter fails, and `refresh()` degrades
that row to a stale badge. `test/unit/robots.test.ts` runs against the real
files captured from each provider, so the exclusions above are asserted rather
than merely documented.

Adapters against a documented partner API can pass `skipRobots: true` to
`fetchJson`, since a signed contract governs access instead of a crawl policy.

Tier B and C endpoints are unofficial and unversioned. The fixture tests in
`test/unit/adapters.test.ts` are the early-warning system: when one starts
failing, run `npm run probe -- --save` and read the diff before touching the
parser.

### Two corridor-level quirks worth knowing

- **Remitly outside the UK.** UK responses include a `pay_out_price_estimates`
  breakdown per rail. USD, AED, and EUR return a single estimate with an empty
  `pay_out_method` and no breakdown — and passing an explicit `pay_out_method`
  parameter is ignored. The adapter accepts that corridor-level rate for any
  rail `supports()` allows, since the rate genuinely is identical and only the
  delivery speed differs.
- **Wise pays out to bank accounts only** for PKR. No wallet, cash, or RDA rails.

---

## Mid-market rates

Wise's public rate endpoints, no key:

- `wise.com/rates/live?source=GBP&target=PKR`
- `wise.com/rates/history+live?source=GBP&target=PKR&length=30&resolution=daily&unit=day`

The obvious alternatives do not work for this corridor:

- **Frankfurter** is ECB-only and the ECB does not publish PKR, so it has no PKR
  at any endpoint.
- **exchangerate.host** now requires a key, caps the free tier at 100
  requests/month, and does not serve HTTPS there.

`open.er-api.com` sits behind the same `FxSource` interface as a fallback. It
needs no key but updates only daily and has no history route — if it is ever the
active source, its attribution link is required in the footer.

---

## Affiliate programmes

Ranking never depends on commission. `lib/ranking/rank.ts` has no parameter for
it, deliberately, so it cannot be added by accident. A `featured` provider is
pinned *below* the best deal with a "Sponsored" label and never above it, which
the ranking tests assert.

| Provider | Network | How to apply |
| --- | --- | --- |
| Wise | Impact | [impact.com](https://impact.com) → search "Wise" → apply to the Wise Affiliate Program |
| Remitly | Impact | Same, "Remitly". Bounty per first completed transfer. |
| WorldRemit | Impact | Same, "WorldRemit". |
| Xe | CJ Affiliate | [cj.com](https://www.cj.com) publisher account → advertiser search "Xe" |
| ACE Money Transfer | Direct | Email their partnerships team; no network involved |
| Sadapay / Nayapay | None | No programme. Listed for completeness, never monetised. |

Once approved, paste the tracking template into `providers.affiliate_url_template`
with a `{clickId}` placeholder. `/go/[provider]` (Phase 4) logs the click and
substitutes it before the 302.

Note that `npm run seed` deliberately does **not** overwrite
`affiliate_url_template` or `featured` on re-run, so production values survive a
reseed.

---

## Architecture notes

```
lib/
  providers/
    types.ts        ProviderAdapter contract, fetchJson with timeouts
    registry.ts     adapter list, runtime filter, BHEJO_DISABLED_ADAPTERS
    refresh.ts      the loop; stale fallback; nothing throws past here
    http/           tier A + B adapters — plain fetch, run anywhere
    browser/        tier C adapters — Playwright, GitHub Actions only
  ranking/
    compute.ts      computeReceived and friends. Pure, no I/O.
    rank.ts         sort order and sponsored placement. No commission input.
  fx/               mid-market sources behind one interface
  db/               Drizzle schema and a lazily-connected client
  corridors.ts      the eight corridors as static config
```

Two rules hold the thing together:

**Nothing throws past `refresh.ts`.** A provider changing its JSON shape at 3am
degrades to a stale badge on one row, not an empty comparison table. Each slot
falls back to the last known good quote, re-written with `stale: true`.

**Every row answers the same question.** `canonicalReceived` always computes in
the `deducted` model — "I have £500 to spend in total, what lands?" — regardless
of how the provider frames its own fee. Comparing a fee-on-top provider at face
value against a fee-deducted one silently favours the former.

---

## Roadmap

- **Phase 2** — the public site: home page from the design file, 8 corridor
  pages, provider and comparison pages, rate pages, Urdu locale with RTL.
- **Phase 3** — rate alerts: double opt-in email, WhatsApp via Twilio,
  once-per-12-hours rate limiting, one-click unsubscribe.
- **Phase 4** — affiliate redirects with click tracking, `/admin` dashboard.
- **Phase 5** — trust and launch: stale badges, accessibility pass, Playwright
  e2e, Lighthouse.

---

## Local Postgres without Supabase

For development you can skip Supabase entirely:

```bash
docker run -d --name bhejo-pg -e POSTGRES_PASSWORD=bhejo -e POSTGRES_DB=bhejo \
  -p 55432:5432 postgres:16-alpine
```

Then set both URLs in `.env.local` to
`postgresql://postgres:bhejo@localhost:55432/bhejo` and run `npm run db:migrate`,
`npm run seed`, `npm run refresh`. The RLS migration is guarded on role
existence, so it applies cleanly against a plain Postgres that has no `anon` or
`authenticated` roles.
