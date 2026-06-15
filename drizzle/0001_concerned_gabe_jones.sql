CREATE TABLE "access_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "firm_groups" (
	"firm_id" text NOT NULL,
	"group_id" text NOT NULL,
	CONSTRAINT "firm_groups_firm_id_group_id_pk" PRIMARY KEY("firm_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jv_leads" (
	"id" text PRIMARY KEY NOT NULL,
	"source_firm_id" text NOT NULL,
	"mentioned_firm_name" text NOT NULL,
	"evidence_summary" text NOT NULL,
	"source_url" text NOT NULL,
	"source_title" text NOT NULL,
	"evidence_date" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "citations" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "firm_groups" ADD CONSTRAINT "firm_groups_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "firm_groups" ADD CONSTRAINT "firm_groups_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jv_leads" ADD CONSTRAINT "jv_leads_source_firm_id_firms_id_fk" FOREIGN KEY ("source_firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "groups_name_unique" ON "groups" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "jv_leads_source_firm_name_unique" ON "jv_leads" USING btree ("source_firm_id","mentioned_firm_name");