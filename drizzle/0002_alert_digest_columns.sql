ALTER TABLE "rate_alerts" ADD COLUMN "last_digest_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rate_alerts" ADD COLUMN "confirmed_at" timestamp with time zone;