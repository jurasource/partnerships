CREATE TABLE "request_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"job_id" text,
	"firm_id" text,
	"topic_id" text,
	"search_query" text,
	"search_results_json" text,
	"model" text,
	"prompt_json" text,
	"raw_response" text,
	"input_tokens" text,
	"output_tokens" text,
	"cache_created_tokens" text,
	"cache_read_tokens" text,
	"finish_reason" text,
	"is_retry" text,
	"duration_ms" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "search_results" text;--> statement-breakpoint
ALTER TABLE "request_logs" ADD CONSTRAINT "request_logs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_logs" ADD CONSTRAINT "request_logs_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_logs" ADD CONSTRAINT "request_logs_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;