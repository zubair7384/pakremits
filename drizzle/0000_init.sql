CREATE TABLE "affiliate_clicks" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"corridor_id" integer,
	"amount_sent" numeric(14, 2),
	"delivery_method" text,
	"click_id" text NOT NULL,
	"referrer" text,
	"utm" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_clicks_click_id_unique" UNIQUE("click_id")
);
--> statement-breakpoint
CREATE TABLE "corridors" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"from_currency" text NOT NULL,
	"from_country" text NOT NULL,
	"from_country_name" text NOT NULL,
	"to_currency" text DEFAULT 'PKR' NOT NULL,
	"currency_symbol" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "corridors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "cron_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"quotes_written" integer DEFAULT 0 NOT NULL,
	"adapters_ok" integer DEFAULT 0 NOT NULL,
	"adapters_failed" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "mid_market_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_currency" text NOT NULL,
	"to_currency" text DEFAULT 'PKR' NOT NULL,
	"rate" numeric(18, 6) NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"brand_color" text DEFAULT '#8A8F8C' NOT NULL,
	"brand_text_color" text DEFAULT '#FFFFFF' NOT NULL,
	"homepage_url" text NOT NULL,
	"affiliate_url_template" text,
	"affiliate_network" text DEFAULT 'none' NOT NULL,
	"commission_note" text,
	"supports_bank" boolean DEFAULT false NOT NULL,
	"supports_wallet" boolean DEFAULT false NOT NULL,
	"supports_neobank" boolean DEFAULT false NOT NULL,
	"supports_cash" boolean DEFAULT false NOT NULL,
	"supports_rda" boolean DEFAULT false NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"is_benchmark" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "providers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rate_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_contact" text NOT NULL,
	"channel" text NOT NULL,
	"from_currency" text NOT NULL,
	"target_rate" numeric(18, 6) NOT NULL,
	"direction" text NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"wants_digest" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"unsubscribe_token" text NOT NULL,
	CONSTRAINT "rate_alerts_unsubscribe_token_unique" UNIQUE("unsubscribe_token")
);
--> statement-breakpoint
CREATE TABLE "rate_quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"corridor_id" integer NOT NULL,
	"delivery_method" text NOT NULL,
	"amount_sent" numeric(14, 2) NOT NULL,
	"rate" numeric(18, 6) NOT NULL,
	"fee" numeric(14, 2) NOT NULL,
	"amount_received" numeric(18, 2) NOT NULL,
	"delivery_speed_text" text NOT NULL,
	"delivery_speed_minutes" integer,
	"promo_flag" boolean DEFAULT false NOT NULL,
	"promo_note" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	"stale" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_quotes" ADD CONSTRAINT "rate_quotes_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_quotes" ADD CONSTRAINT "rate_quotes_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "affiliate_clicks_report_idx" ON "affiliate_clicks" USING btree ("created_at","provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "corridors_from_currency_idx" ON "corridors" USING btree ("from_currency");--> statement-breakpoint
CREATE INDEX "mid_market_lookup_idx" ON "mid_market_rates" USING btree ("from_currency","captured_at");--> statement-breakpoint
CREATE INDEX "rate_alerts_eval_idx" ON "rate_alerts" USING btree ("from_currency","active","confirmed");--> statement-breakpoint
CREATE INDEX "rate_quotes_lookup_idx" ON "rate_quotes" USING btree ("corridor_id","delivery_method","amount_sent","captured_at");--> statement-breakpoint
CREATE INDEX "rate_quotes_provider_idx" ON "rate_quotes" USING btree ("provider_id","captured_at");