CREATE TABLE "collaboration_records" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"culture_fit_summary" text,
	"source_url" text NOT NULL,
	"source_title" text NOT NULL,
	"raw_snippet" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conflict_pairs" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_a_id" text NOT NULL,
	"firm_b_id" text NOT NULL,
	"conflict_type" text NOT NULL,
	"evidence_summary" text NOT NULL,
	"source_url" text NOT NULL,
	"source_title" text NOT NULL,
	"raw_snippet" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"summary" text NOT NULL,
	"source_url" text NOT NULL,
	"source_title" text NOT NULL,
	"raw_snippet" text NOT NULL,
	"source_date" text,
	"confidence" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "firms" (
	"id" text PRIMARY KEY NOT NULL,
	"canonical_name" text NOT NULL,
	"aliases" text DEFAULT '[]' NOT NULL,
	"companies_house_number" text,
	"capability_tags" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_researched_at" text
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"topic_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" text,
	"completed_at" text,
	"error_message" text,
	"progress_message" text,
	"job_type" text DEFAULT 'research' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ownership_records" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"uk_incorporated" text NOT NULL,
	"ultimate_parent" text,
	"country_of_ownership" text,
	"psc_not_traceable" text DEFAULT 'no' NOT NULL,
	"source_type" text NOT NULL,
	"source_url" text NOT NULL,
	"source_title" text NOT NULL,
	"raw_snippet" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partnership_pairs" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_a_id" text NOT NULL,
	"firm_b_id" text NOT NULL,
	"partnership_type" text NOT NULL,
	"evidence_summary" text NOT NULL,
	"source_type" text NOT NULL,
	"source_url" text NOT NULL,
	"source_title" text NOT NULL,
	"evidence_date" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procurement_records" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"ocid" text NOT NULL,
	"source_api" text NOT NULL,
	"title" text,
	"notice_date" text,
	"value" text,
	"supplier_ch_number" text,
	"award_date" text,
	"contracting_authority" text,
	"raw_json" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_flags" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"flag_type" text NOT NULL,
	"severity" text NOT NULL,
	"description" text NOT NULL,
	"source_url" text NOT NULL,
	"source_title" text NOT NULL,
	"source_date" text,
	"raw_snippet" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collaboration_records" ADD CONSTRAINT "collaboration_records_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict_pairs" ADD CONSTRAINT "conflict_pairs_firm_a_id_firms_id_fk" FOREIGN KEY ("firm_a_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict_pairs" ADD CONSTRAINT "conflict_pairs_firm_b_id_firms_id_fk" FOREIGN KEY ("firm_b_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_records" ADD CONSTRAINT "ownership_records_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_pairs" ADD CONSTRAINT "partnership_pairs_firm_a_id_firms_id_fk" FOREIGN KEY ("firm_a_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_pairs" ADD CONSTRAINT "partnership_pairs_firm_b_id_firms_id_fk" FOREIGN KEY ("firm_b_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_records" ADD CONSTRAINT "procurement_records_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_flags" ADD CONSTRAINT "risk_flags_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "collaboration_records_firm_unique" ON "collaboration_records" USING btree ("firm_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conflict_pairs_unique" ON "conflict_pairs" USING btree ("firm_a_id","firm_b_id","conflict_type");--> statement-breakpoint
CREATE UNIQUE INDEX "findings_firm_topic_unique" ON "findings" USING btree ("firm_id","topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ownership_records_firm_unique" ON "ownership_records" USING btree ("firm_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partnership_pairs_unique" ON "partnership_pairs" USING btree ("firm_a_id","firm_b_id","partnership_type","source_url");--> statement-breakpoint
CREATE UNIQUE INDEX "procurement_records_ocid_unique" ON "procurement_records" USING btree ("ocid");