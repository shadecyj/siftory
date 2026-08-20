CREATE TABLE "excluded_sources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"stage" text NOT NULL,
	"reason_code" text NOT NULL,
	"public_summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intent_assessments" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"normalized_question" text NOT NULL,
	"selected_mode" "search_mode" NOT NULL,
	"mode_confidence" real NOT NULL,
	"entities" jsonb NOT NULL,
	"constraints" jsonb NOT NULL,
	"freshness_requirement" text NOT NULL,
	"ambiguity_notes" jsonb NOT NULL,
	"assumptions" jsonb NOT NULL,
	"classifier_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_calls" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"provider" text NOT NULL,
	"model" text,
	"status" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retrieval_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"query_id" uuid NOT NULL,
	"status" text NOT NULL,
	"candidate_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"error_code" text
);
--> statement-breakpoint
CREATE TABLE "search_queries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"step_id" uuid,
	"query" text NOT NULL,
	"round" integer NOT NULL,
	"provider" text NOT NULL,
	"language" text NOT NULL,
	"freshness" text,
	"query_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_documents" (
	"snapshot_id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"normalized_text" text NOT NULL,
	"blocks" jsonb NOT NULL,
	"truncated" boolean DEFAULT false NOT NULL,
	"parser_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "search_runs" ADD COLUMN "cancel_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "search_runs" ADD COLUMN "heartbeat_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "search_runs" ADD COLUMN "checkpoint" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "excluded_sources" ADD CONSTRAINT "excluded_sources_run_id_search_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."search_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intent_assessments" ADD CONSTRAINT "intent_assessments_run_id_search_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."search_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_calls" ADD CONSTRAINT "provider_calls_run_id_search_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."search_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_attempts" ADD CONSTRAINT "retrieval_attempts_query_id_search_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."search_queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_run_id_search_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."search_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_step_id_plan_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."plan_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "excluded_sources_run_idx" ON "excluded_sources" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "provider_calls_run_idx" ON "provider_calls" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "search_queries_run_hash_uidx" ON "search_queries" USING btree ("run_id","query_hash");