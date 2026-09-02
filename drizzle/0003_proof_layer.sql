CREATE TABLE "bank_benchmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"corridor_id" integer NOT NULL,
	"delivery_method" text NOT NULL,
	"rate" numeric(18, 6) NOT NULL,
	"fee" numeric(14, 2) NOT NULL,
	"note" text,
	"pinned" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comparison_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"minute_bucket" timestamp with time zone NOT NULL,
	"corridor_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corridor_leaders" (
	"corridor_id" integer PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"since" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"affiliate_click_id" integer NOT NULL,
	"corridor_id" integer,
	"provider_id" integer NOT NULL,
	"amount_sent" numeric(14, 2) NOT NULL,
	"provider_received_pkr" numeric(18, 2) NOT NULL,
	"bank_received_pkr" numeric(18, 2),
	"saving_pkr" numeric(18, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "savings_ledger_affiliate_click_id_unique" UNIQUE("affiliate_click_id")
);
--> statement-breakpoint
CREATE TABLE "site_stats_daily" (
	"date" text PRIMARY KEY NOT NULL,
	"comparisons_run" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"saving_pkr_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"best_provider_changes" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_benchmarks" ADD CONSTRAINT "bank_benchmarks_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparison_events" ADD CONSTRAINT "comparison_events_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corridor_leaders" ADD CONSTRAINT "corridor_leaders_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corridor_leaders" ADD CONSTRAINT "corridor_leaders_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_ledger" ADD CONSTRAINT "savings_ledger_affiliate_click_id_affiliate_clicks_id_fk" FOREIGN KEY ("affiliate_click_id") REFERENCES "public"."affiliate_clicks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_ledger" ADD CONSTRAINT "savings_ledger_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_ledger" ADD CONSTRAINT "savings_ledger_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bank_benchmarks_slot_idx" ON "bank_benchmarks" USING btree ("corridor_id","delivery_method");--> statement-breakpoint
CREATE UNIQUE INDEX "comparison_events_dedup_idx" ON "comparison_events" USING btree ("session_id","minute_bucket");--> statement-breakpoint
CREATE INDEX "comparison_events_created_idx" ON "comparison_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "savings_ledger_report_idx" ON "savings_ledger" USING btree ("created_at","corridor_id");