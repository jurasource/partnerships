CREATE TABLE "ch_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"profile_json" text,
	"psc_json" text,
	"officers_json" text,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ch_snapshots" ADD CONSTRAINT "ch_snapshots_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ch_snapshots_firm_unique" ON "ch_snapshots" USING btree ("firm_id");
