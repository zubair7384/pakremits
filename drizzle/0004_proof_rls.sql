-- Row-level security for the proof-layer tables.
--
-- Same posture as 0001_rls.sql: enable RLS, grant no policies, so Supabase's
-- auto-generated PostgREST endpoint returns nothing on these tables while the
-- server routes (which run as the table owner and bypass RLS) keep working.
--
-- Two of these matter more than the rest. `comparison_events` holds the opaque
-- per-browser session id used for dedup, and `savings_ledger` holds the amount
-- every individual click was about to send — a per-user spending signal. Left
-- open, both would be readable by anyone holding the anon key.

ALTER TABLE "bank_benchmarks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "savings_ledger" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "site_stats_daily" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "comparison_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "corridor_leaders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Re-run the revoke from 0001. `ALL TABLES IN SCHEMA public` is evaluated at
-- execution time, so the grants Supabase attached to the five tables created in
-- 0003 are only caught by running it again now.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
  END IF;
END $$;
