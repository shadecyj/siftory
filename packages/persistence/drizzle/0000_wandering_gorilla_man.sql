CREATE TYPE "public"."authority" AS ENUM('STRONG', 'ADEQUATE', 'WEAK', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."claim_importance" AS ENUM('DECISIVE', 'KEY', 'SUPPORTING', 'BACKGROUND');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('CANDIDATE', 'EVALUATED', 'INCLUDED', 'EXCLUDED');--> statement-breakpoint
CREATE TYPE "public"."claim_type" AS ENUM('FACT', 'CAPABILITY', 'COMPARISON', 'RECOMMENDATION', 'DEFINITION', 'PROCEDURE');--> statement-breakpoint
CREATE TYPE "public"."conflict_severity" AS ENUM('MINOR', 'MATERIAL');--> statement-breakpoint
CREATE TYPE "public"."conflict_status" AS ENUM('OPEN', 'EXPLAINED', 'RESOLVED');--> statement-breakpoint
CREATE TYPE "public"."evidence_relevance" AS ENUM('DIRECT', 'PARTIAL', 'CONTEXTUAL', 'UNRELATED');--> statement-breakpoint
CREATE TYPE "public"."evidence_stance" AS ENUM('SUPPORTS', 'CONTRADICTS', 'QUALIFIES', 'CONTEXTUAL');--> statement-breakpoint
CREATE TYPE "public"."evidence_type" AS ENUM('QUOTE', 'TABLE', 'CODE', 'DATA', 'METADATA', 'VISUAL');--> statement-breakpoint
CREATE TYPE "public"."freshness" AS ENUM('CURRENT', 'ACCEPTABLE', 'STALE', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."note_anchor" AS ENUM('NOTE', 'CLAIM', 'EVIDENCE');--> statement-breakpoint
CREATE TYPE "public"."overall_trust" AS ENUM('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT', 'MIXED');--> statement-breakpoint
CREATE TYPE "public"."parse_status" AS ENUM('PARSED', 'PARTIAL', 'FAILED', 'BLOCKED');--> statement-breakpoint
CREATE TYPE "public"."primary_context" AS ENUM('PRIMARY', 'SECONDARY', 'MIXED', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."requested_mode" AS ENUM('AUTO', 'QUICK', 'COMPARE', 'RESEARCH');--> statement-breakpoint
CREATE TYPE "public"."run_state" AS ENUM('CREATED', 'UNDERSTANDING', 'PLANNING', 'RETRIEVING', 'EXTRACTING', 'EVALUATING', 'GAP_CHECK', 'SYNTHESIZING', 'MATERIALIZING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."run_trigger" AS ENUM('INITIAL', 'MODE_SWITCH', 'RETRY', 'CONTINUE', 'UPDATE');--> statement-breakpoint
CREATE TYPE "public"."search_mode" AS ENUM('QUICK', 'COMPARE', 'RESEARCH');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('OFFICIAL_DOC', 'GITHUB', 'PAPER', 'GOVERNMENT', 'ARTICLE', 'FORUM', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."trust_level" AS ENUM('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT');--> statement-breakpoint
CREATE TABLE "claim_evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"claim_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"stance" "evidence_stance" NOT NULL,
	"relevance" "evidence_relevance" NOT NULL,
	"authority" "authority" NOT NULL,
	"primary_context" "primary_context" NOT NULL,
	"freshness" "freshness" NOT NULL,
	"independence_group" text NOT NULL,
	"assessment_notes" jsonb NOT NULL,
	"evaluator_version" text NOT NULL,
	"assessed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_trust_summaries" (
	"claim_id" uuid PRIMARY KEY NOT NULL,
	"level" "trust_level" NOT NULL,
	"supporting_evidence_count" integer NOT NULL,
	"contradicting_evidence_count" integer NOT NULL,
	"independent_support_count" integer NOT NULL,
	"primary_source_count" integer NOT NULL,
	"reason_codes" jsonb NOT NULL,
	"explanation" text NOT NULL,
	"unresolved_material_conflict" boolean DEFAULT false NOT NULL,
	"ruleset_version" text NOT NULL,
	"evaluated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"statement" text NOT NULL,
	"normalized_statement" text NOT NULL,
	"statement_hash" text NOT NULL,
	"claim_type" "claim_type" NOT NULL,
	"importance" "claim_importance" NOT NULL,
	"status" "claim_status" NOT NULL,
	"scope" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conflicts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"subject_claim_id" uuid NOT NULL,
	"conflicting_claim_id" uuid,
	"severity" "conflict_severity" NOT NULL,
	"status" "conflict_status" NOT NULL,
	"summary" text NOT NULL,
	"claim_evidence_ids" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"evidence_type" "evidence_type" NOT NULL,
	"excerpt" text NOT NULL,
	"paraphrase" text NOT NULL,
	"locator" jsonb NOT NULL,
	"evidence_hash" text NOT NULL,
	"extraction_method" text NOT NULL,
	"extractor_version" text NOT NULL,
	"language" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_claims" (
	"revision_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"statement_snapshot" text NOT NULL,
	"trust_level_snapshot" "trust_level" NOT NULL,
	"display_order" integer NOT NULL,
	"is_key" boolean DEFAULT false NOT NULL,
	CONSTRAINT "note_claims_revision_id_claim_id_pk" PRIMARY KEY("revision_id","claim_id")
);
--> statement-breakpoint
CREATE TABLE "note_revisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"note_id" uuid NOT NULL,
	"revision_no" integer NOT NULL,
	"source_run_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"overall_confidence" "overall_trust" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"plan_id" uuid NOT NULL,
	"goal" text NOT NULL,
	"query_templates" jsonb NOT NULL,
	"preferred_source_types" jsonb NOT NULL,
	"completion_criteria" jsonb NOT NULL,
	"priority" integer NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"event_type" text NOT NULL,
	"from_state" "run_state",
	"to_state" "run_state" NOT NULL,
	"summary" text NOT NULL,
	"payload_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"source_run_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"mode" "search_mode" NOT NULL,
	"overall_confidence" "overall_trust" NOT NULL,
	"is_saved" boolean DEFAULT false NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"current_revision_no" integer DEFAULT 1 NOT NULL,
	"my_notes" text DEFAULT '' NOT NULL,
	"search_date" timestamp with time zone NOT NULL,
	"last_viewed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"objective" text NOT NULL,
	"stop_conditions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"parent_run_id" uuid,
	"trigger" "run_trigger" NOT NULL,
	"requested_mode" "requested_mode" NOT NULL,
	"selected_mode" "search_mode",
	"mode_confidence" real,
	"state" "run_state" NOT NULL,
	"current_stage" "run_state" NOT NULL,
	"budget" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"budget_used" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stop_reason" text,
	"partial_reason" text,
	"error_code" text,
	"error_detail" text,
	"version" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"original_question" text NOT NULL,
	"current_question" text NOT NULL,
	"latest_run_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"content_hash" text NOT NULL,
	"content_type" text NOT NULL,
	"version_label" text,
	"storage_ref" text,
	"parse_status" "parse_status" NOT NULL,
	"parser_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"canonical_url" text NOT NULL,
	"url_hash" text NOT NULL,
	"source_type" "source_type" NOT NULL,
	"title" text NOT NULL,
	"publisher" text NOT NULL,
	"domain" text NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at_source" timestamp with time zone,
	"language" text NOT NULL,
	"is_official" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "structured_results" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"title" text NOT NULL,
	"answer_sections" jsonb NOT NULL,
	"decisive_claim_ids" jsonb NOT NULL,
	"key_claim_ids" jsonb NOT NULL,
	"source_ids" jsonb NOT NULL,
	"overall_confidence" "overall_trust" NOT NULL,
	"confidence_reason_codes" jsonb NOT NULL,
	"confidence_explanation" jsonb NOT NULL,
	"limitations" jsonb NOT NULL,
	"synthesis_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"note_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"anchor_type" "note_anchor" DEFAULT 'NOTE' NOT NULL,
	"anchor_id" uuid,
	"body" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_trust_summaries" ADD CONSTRAINT "claim_trust_summaries_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_run_id_search_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."search_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflicts" ADD CONSTRAINT "conflicts_run_id_search_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."search_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflicts" ADD CONSTRAINT "conflicts_subject_claim_id_claims_id_fk" FOREIGN KEY ("subject_claim_id") REFERENCES "public"."claims"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflicts" ADD CONSTRAINT "conflicts_conflicting_claim_id_claims_id_fk" FOREIGN KEY ("conflicting_claim_id") REFERENCES "public"."claims"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_claims" ADD CONSTRAINT "note_claims_revision_id_note_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."note_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_claims" ADD CONSTRAINT "note_claims_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_revisions" ADD CONSTRAINT "note_revisions_note_id_search_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."search_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_revisions" ADD CONSTRAINT "note_revisions_source_run_id_search_runs_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."search_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_steps" ADD CONSTRAINT "plan_steps_plan_id_search_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."search_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_run_id_search_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."search_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_notes" ADD CONSTRAINT "search_notes_task_id_search_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."search_tasks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_notes" ADD CONSTRAINT "search_notes_source_run_id_search_runs_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."search_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_plans" ADD CONSTRAINT "search_plans_run_id_search_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."search_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_runs" ADD CONSTRAINT "search_runs_task_id_search_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."search_tasks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_snapshots" ADD CONSTRAINT "source_snapshots_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "structured_results" ADD CONSTRAINT "structured_results_run_id_search_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."search_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notes" ADD CONSTRAINT "user_notes_note_id_search_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."search_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "claim_evidence_pair_uidx" ON "claim_evidence" USING btree ("claim_id","evidence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "claims_run_statement_uidx" ON "claims" USING btree ("run_id","statement_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_snapshot_hash_uidx" ON "evidence" USING btree ("snapshot_id","evidence_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "note_revisions_note_revision_uidx" ON "note_revisions" USING btree ("note_id","revision_no");--> statement-breakpoint
CREATE UNIQUE INDEX "run_events_run_sequence_uidx" ON "run_events" USING btree ("run_id","sequence");--> statement-breakpoint
CREATE INDEX "search_notes_owner_updated_idx" ON "search_notes" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "search_plans_run_version_uidx" ON "search_plans" USING btree ("run_id","version");--> statement-breakpoint
CREATE INDEX "search_runs_task_created_idx" ON "search_runs" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "search_runs_state_idx" ON "search_runs" USING btree ("state");--> statement-breakpoint
CREATE INDEX "search_tasks_owner_updated_idx" ON "search_tasks" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "source_snapshots_source_content_uidx" ON "source_snapshots" USING btree ("source_id","content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_url_hash_uidx" ON "sources" USING btree ("url_hash");