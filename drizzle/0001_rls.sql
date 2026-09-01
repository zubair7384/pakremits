-- Row-level security.
--
-- Supabase exposes every table through PostgREST on the `anon` and
-- `authenticated` roles by default. Bhejo has no client-side database access —
-- everything goes through server routes on the pooled Postgres connection,
-- which runs as the table owner and bypasses RLS.
--
-- So the correct posture is: enable RLS everywhere and grant no policies to
-- anon/authenticated. That makes the auto-generated REST API return nothing,
-- while the app keeps working unchanged. Without this, `rate_alerts` — email
-- addresses and phone numbers — would be world-readable over HTTPS.

ALTER TABLE "rate_alerts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "cron_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Reference data. Still locked down: it is served through our own cached
-- routes, and an open endpoint would let anyone scrape the whole quote history.
ALTER TABLE "rate_quotes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mid_market_rates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "providers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "corridors" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Belt and braces: revoke the blanket grants Supabase hands these roles, so a
-- future table-level policy cannot accidentally re-open everything.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- Deliberately no CREATE POLICY statements. If you later add client-side reads
-- (say, a public rates widget), add a narrow SELECT policy for that table only
-- and document why here.
