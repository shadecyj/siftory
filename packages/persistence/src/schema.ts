import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow()
};

export const requestedModeEnum = pgEnum("requested_mode", ["AUTO", "QUICK", "COMPARE", "RESEARCH"]);
export const searchModeEnum = pgEnum("search_mode", ["QUICK", "COMPARE", "RESEARCH"]);
export const runStateEnum = pgEnum("run_state", [
  "CREATED", "UNDERSTANDING", "PLANNING", "RETRIEVING", "EXTRACTING", "EVALUATING",
  "GAP_CHECK", "SYNTHESIZING", "MATERIALIZING", "COMPLETED", "PARTIAL", "FAILED", "CANCELLED"
]);
export const runTriggerEnum = pgEnum("run_trigger", ["INITIAL", "MODE_SWITCH", "RETRY", "CONTINUE", "UPDATE"]);
export const trustLevelEnum = pgEnum("trust_level", ["HIGH", "MEDIUM", "LOW", "INSUFFICIENT"]);
export const overallTrustEnum = pgEnum("overall_trust", ["HIGH", "MEDIUM", "LOW", "INSUFFICIENT", "MIXED"]);
export const sourceTypeEnum = pgEnum("source_type", ["OFFICIAL_DOC", "GITHUB", "PAPER", "GOVERNMENT", "ARTICLE", "FORUM", "OTHER"]);
export const parseStatusEnum = pgEnum("parse_status", ["PARSED", "PARTIAL", "FAILED", "BLOCKED"]);
export const evidenceTypeEnum = pgEnum("evidence_type", ["QUOTE", "TABLE", "CODE", "DATA", "METADATA", "VISUAL"]);
export const evidenceStanceEnum = pgEnum("evidence_stance", ["SUPPORTS", "CONTRADICTS", "QUALIFIES", "CONTEXTUAL"]);
export const evidenceRelevanceEnum = pgEnum("evidence_relevance", ["DIRECT", "PARTIAL", "CONTEXTUAL", "UNRELATED"]);
export const authorityEnum = pgEnum("authority", ["STRONG", "ADEQUATE", "WEAK", "UNKNOWN"]);
export const primaryContextEnum = pgEnum("primary_context", ["PRIMARY", "SECONDARY", "MIXED", "UNKNOWN"]);
export const freshnessEnum = pgEnum("freshness", ["CURRENT", "ACCEPTABLE", "STALE", "UNKNOWN"]);
export const claimTypeEnum = pgEnum("claim_type", ["FACT", "CAPABILITY", "COMPARISON", "RECOMMENDATION", "DEFINITION", "PROCEDURE"]);
export const claimImportanceEnum = pgEnum("claim_importance", ["DECISIVE", "KEY", "SUPPORTING", "BACKGROUND"]);
export const claimStatusEnum = pgEnum("claim_status", ["CANDIDATE", "EVALUATED", "INCLUDED", "EXCLUDED"]);
export const conflictSeverityEnum = pgEnum("conflict_severity", ["MINOR", "MATERIAL"]);
export const conflictStatusEnum = pgEnum("conflict_status", ["OPEN", "EXPLAINED", "RESOLVED"]);
export const noteAnchorEnum = pgEnum("note_anchor", ["NOTE", "CLAIM", "EVIDENCE"]);
export const noteCategoryEnum = pgEnum("note_category", [
  "INBOX", "TECHNOLOGY", "AI_DATA", "PRODUCT_BUSINESS", "LEARNING_RESEARCH", "WORK", "LIFE", "OTHER"
]);

export const searchTasks = pgTable("search_tasks", {
  id: uuid("id").primaryKey(),
  ownerId: uuid("owner_id").notNull(),
  originalQuestion: text("original_question").notNull(),
  currentQuestion: text("current_question").notNull(),
  latestRunId: uuid("latest_run_id"),
  status: text("status").notNull().default("active"),
  schemaVersion: smallint("schema_version").notNull().default(1),
  ...timestamps
}, (table) => [index("search_tasks_owner_updated_idx").on(table.ownerId, table.updatedAt)]);

export const searchRuns = pgTable("search_runs", {
  id: uuid("id").primaryKey(),
  taskId: uuid("task_id").notNull().references(() => searchTasks.id, { onDelete: "restrict" }),
  parentRunId: uuid("parent_run_id"),
  trigger: runTriggerEnum("trigger").notNull(),
  requestedMode: requestedModeEnum("requested_mode").notNull(),
  selectedMode: searchModeEnum("selected_mode"),
  modeConfidence: real("mode_confidence"),
  state: runStateEnum("state").notNull(),
  currentStage: runStateEnum("current_stage").notNull(),
  budget: jsonb("budget").notNull().default({}),
  budgetUsed: jsonb("budget_used").notNull().default({}),
  stopReason: text("stop_reason"),
  partialReason: text("partial_reason"),
  errorCode: text("error_code"),
  errorDetail: text("error_detail"),
  cancelRequestedAt: timestamp("cancel_requested_at", { withTimezone: true, mode: "string" }),
  heartbeatAt: timestamp("heartbeat_at", { withTimezone: true, mode: "string" }),
  checkpoint: jsonb("checkpoint").notNull().default({}),
  version: integer("version").notNull().default(1),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "string" }),
  ...timestamps
}, (table) => [index("search_runs_task_created_idx").on(table.taskId, table.createdAt), index("search_runs_state_idx").on(table.state)]);

export const runEvents = pgTable("run_events", {
  id: uuid("id").primaryKey(),
  runId: uuid("run_id").notNull().references(() => searchRuns.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  eventType: text("event_type").notNull(),
  fromState: runStateEnum("from_state"),
  toState: runStateEnum("to_state").notNull(),
  summary: text("summary").notNull(),
  payloadSummary: jsonb("payload_summary").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow()
}, (table) => [uniqueIndex("run_events_run_sequence_uidx").on(table.runId, table.sequence)]);

export const searchPlans = pgTable("search_plans", {
  id: uuid("id").primaryKey(),
  runId: uuid("run_id").notNull().references(() => searchRuns.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  objective: text("objective").notNull(),
  stopConditions: jsonb("stop_conditions").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow()
}, (table) => [uniqueIndex("search_plans_run_version_uidx").on(table.runId, table.version)]);

export const planSteps = pgTable("plan_steps", {
  id: uuid("id").primaryKey(),
  planId: uuid("plan_id").notNull().references(() => searchPlans.id, { onDelete: "cascade" }),
  goal: text("goal").notNull(),
  queryTemplates: jsonb("query_templates").notNull(),
  preferredSourceTypes: jsonb("preferred_source_types").notNull(),
  completionCriteria: jsonb("completion_criteria").notNull(),
  priority: integer("priority").notNull(),
  status: text("status").notNull()
});

export const intentAssessments = pgTable("intent_assessments", {
  runId: uuid("run_id").primaryKey().references(() => searchRuns.id, { onDelete: "cascade" }),
  normalizedQuestion: text("normalized_question").notNull(),
  selectedMode: searchModeEnum("selected_mode").notNull(),
  modeConfidence: real("mode_confidence").notNull(),
  entities: jsonb("entities").notNull(),
  constraints: jsonb("constraints").notNull(),
  freshnessRequirement: text("freshness_requirement").notNull(),
  ambiguityNotes: jsonb("ambiguity_notes").notNull(),
  assumptions: jsonb("assumptions").notNull(),
  classifierVersion: text("classifier_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow()
});

export const searchQueries = pgTable("search_queries", {
  id: uuid("id").primaryKey(),
  runId: uuid("run_id").notNull().references(() => searchRuns.id, { onDelete: "cascade" }),
  stepId: uuid("step_id").references(() => planSteps.id, { onDelete: "set null" }),
  query: text("query").notNull(),
  round: integer("round").notNull(),
  provider: text("provider").notNull(),
  language: text("language").notNull(),
  freshness: text("freshness"),
  queryHash: text("query_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow()
}, (table) => [uniqueIndex("search_queries_run_hash_uidx").on(table.runId, table.queryHash)]);

export const retrievalAttempts = pgTable("retrieval_attempts", {
  id: uuid("id").primaryKey(),
  queryId: uuid("query_id").notNull().references(() => searchQueries.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  candidateCount: integer("candidate_count").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
  errorCode: text("error_code")
});

export const sources = pgTable("sources", {
  id: uuid("id").primaryKey(),
  canonicalUrl: text("canonical_url").notNull(),
  urlHash: text("url_hash").notNull(),
  sourceType: sourceTypeEnum("source_type").notNull(),
  title: text("title").notNull(),
  publisher: text("publisher").notNull(),
  domain: text("domain").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true, mode: "string" }),
  updatedAtSource: timestamp("updated_at_source", { withTimezone: true, mode: "string" }),
  language: text("language").notNull(),
  isOfficial: boolean("is_official").notNull().default(false),
  metadata: jsonb("metadata").notNull().default({}),
  ...timestamps
}, (table) => [uniqueIndex("sources_url_hash_uidx").on(table.urlHash)]);

export const sourceSnapshots = pgTable("source_snapshots", {
  id: uuid("id").primaryKey(),
  sourceId: uuid("source_id").notNull().references(() => sources.id, { onDelete: "restrict" }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "string" }).notNull(),
  contentHash: text("content_hash").notNull(),
  contentType: text("content_type").notNull(),
  versionLabel: text("version_label"),
  storageRef: text("storage_ref"),
  parseStatus: parseStatusEnum("parse_status").notNull(),
  parserVersion: text("parser_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow()
}, (table) => [uniqueIndex("source_snapshots_source_content_uidx").on(table.sourceId, table.contentHash)]);

export const claims = pgTable("claims", {
  id: uuid("id").primaryKey(),
  runId: uuid("run_id").notNull().references(() => searchRuns.id, { onDelete: "restrict" }),
  statement: text("statement").notNull(),
  normalizedStatement: text("normalized_statement").notNull(),
  statementHash: text("statement_hash").notNull(),
  claimType: claimTypeEnum("claim_type").notNull(),
  importance: claimImportanceEnum("importance").notNull(),
  status: claimStatusEnum("status").notNull(),
  scope: jsonb("scope").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow()
}, (table) => [uniqueIndex("claims_run_statement_uidx").on(table.runId, table.statementHash)]);

export const evidence = pgTable("evidence", {
  id: uuid("id").primaryKey(),
  snapshotId: uuid("snapshot_id").notNull().references(() => sourceSnapshots.id, { onDelete: "restrict" }),
  evidenceType: evidenceTypeEnum("evidence_type").notNull(),
  excerpt: text("excerpt").notNull(),
  paraphrase: text("paraphrase").notNull(),
  locator: jsonb("locator").notNull(),
  evidenceHash: text("evidence_hash").notNull(),
  extractionMethod: text("extraction_method").notNull(),
  extractorVersion: text("extractor_version").notNull(),
  language: text("language").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow()
}, (table) => [uniqueIndex("evidence_snapshot_hash_uidx").on(table.snapshotId, table.evidenceHash)]);

export const claimEvidence = pgTable("claim_evidence", {
  id: uuid("id").primaryKey(),
  claimId: uuid("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  evidenceId: uuid("evidence_id").notNull().references(() => evidence.id, { onDelete: "restrict" }),
  stance: evidenceStanceEnum("stance").notNull(),
  relevance: evidenceRelevanceEnum("relevance").notNull(),
  authority: authorityEnum("authority").notNull(),
  primaryContext: primaryContextEnum("primary_context").notNull(),
  freshness: freshnessEnum("freshness").notNull(),
  independenceGroup: text("independence_group").notNull(),
  assessmentNotes: jsonb("assessment_notes").notNull(),
  evaluatorVersion: text("evaluator_version").notNull(),
  assessedAt: timestamp("assessed_at", { withTimezone: true, mode: "string" }).notNull()
}, (table) => [uniqueIndex("claim_evidence_pair_uidx").on(table.claimId, table.evidenceId)]);

export const claimTrustSummaries = pgTable("claim_trust_summaries", {
  claimId: uuid("claim_id").primaryKey().references(() => claims.id, { onDelete: "cascade" }),
  level: trustLevelEnum("level").notNull(),
  supportingEvidenceCount: integer("supporting_evidence_count").notNull(),
  contradictingEvidenceCount: integer("contradicting_evidence_count").notNull(),
  independentSupportCount: integer("independent_support_count").notNull(),
  primarySourceCount: integer("primary_source_count").notNull(),
  reasonCodes: jsonb("reason_codes").notNull(),
  explanation: text("explanation").notNull(),
  unresolvedMaterialConflict: boolean("unresolved_material_conflict").notNull().default(false),
  rulesetVersion: text("ruleset_version").notNull(),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true, mode: "string" }).notNull()
});

export const sourceDocuments = pgTable("source_documents", {
  snapshotId: uuid("snapshot_id").primaryKey().references(() => sourceSnapshots.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  normalizedText: text("normalized_text").notNull(),
  blocks: jsonb("blocks").notNull(),
  truncated: boolean("truncated").notNull().default(false),
  parserVersion: text("parser_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow()
});

export const excludedSources = pgTable("excluded_sources", {
  id: uuid("id").primaryKey(),
  runId: uuid("run_id").notNull().references(() => searchRuns.id, { onDelete: "cascade" }),
  sourceUrl: text("source_url").notNull(),
  stage: text("stage").notNull(),
  reasonCode: text("reason_code").notNull(),
  publicSummary: text("public_summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow()
}, (table) => [index("excluded_sources_run_idx").on(table.runId)]);

export const providerCalls = pgTable("provider_calls", {
  id: uuid("id").primaryKey(),
  runId: uuid("run_id").notNull().references(() => searchRuns.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  provider: text("provider").notNull(),
  model: text("model"),
  status: text("status").notNull(),
  durationMs: integer("duration_ms").notNull(),
  usage: jsonb("usage").notNull().default({}),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow()
}, (table) => [index("provider_calls_run_idx").on(table.runId)]);

export const conflicts = pgTable("conflicts", {
  id: uuid("id").primaryKey(),
  runId: uuid("run_id").notNull().references(() => searchRuns.id, { onDelete: "restrict" }),
  subjectClaimId: uuid("subject_claim_id").notNull().references(() => claims.id, { onDelete: "restrict" }),
  conflictingClaimId: uuid("conflicting_claim_id").references(() => claims.id, { onDelete: "restrict" }),
  severity: conflictSeverityEnum("severity").notNull(),
  status: conflictStatusEnum("status").notNull(),
  summary: text("summary").notNull(),
  claimEvidenceIds: jsonb("claim_evidence_ids").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow()
});

export const structuredResults = pgTable("structured_results", {
  runId: uuid("run_id").primaryKey().references(() => searchRuns.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  title: text("title").notNull(),
  answerSections: jsonb("answer_sections").notNull(),
  decisiveClaimIds: jsonb("decisive_claim_ids").notNull(),
  keyClaimIds: jsonb("key_claim_ids").notNull(),
  sourceIds: jsonb("source_ids").notNull(),
  overallConfidence: overallTrustEnum("overall_confidence").notNull(),
  confidenceReasonCodes: jsonb("confidence_reason_codes").notNull(),
  confidenceExplanation: jsonb("confidence_explanation").notNull(),
  limitations: jsonb("limitations").notNull(),
  synthesisVersion: text("synthesis_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow()
});

export const searchNotes = pgTable("search_notes", {
  id: uuid("id").primaryKey(),
  ownerId: uuid("owner_id").notNull(),
  taskId: uuid("task_id").notNull().references(() => searchTasks.id, { onDelete: "restrict" }),
  sourceRunId: uuid("source_run_id").notNull().references(() => searchRuns.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  mode: searchModeEnum("mode").notNull(),
  overallConfidence: overallTrustEnum("overall_confidence").notNull(),
  isSaved: boolean("is_saved").notNull().default(false),
  isFavorite: boolean("is_favorite").notNull().default(false),
  category: noteCategoryEnum("category").notNull().default("INBOX"),
  currentRevisionNo: integer("current_revision_no").notNull().default(1),
  myNotes: text("my_notes").notNull().default(""),
  searchDate: timestamp("search_date", { withTimezone: true, mode: "string" }).notNull(),
  lastViewedAt: timestamp("last_viewed_at", { withTimezone: true, mode: "string" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  ...timestamps
}, (table) => [
  index("search_notes_owner_updated_idx").on(table.ownerId, table.updatedAt),
  index("search_notes_owner_category_idx").on(table.ownerId, table.category),
  index("search_notes_owner_favorite_idx").on(table.ownerId, table.isFavorite)
]);

export const noteRevisions = pgTable("note_revisions", {
  id: uuid("id").primaryKey(),
  noteId: uuid("note_id").notNull().references(() => searchNotes.id, { onDelete: "cascade" }),
  revisionNo: integer("revision_no").notNull(),
  sourceRunId: uuid("source_run_id").notNull().references(() => searchRuns.id, { onDelete: "restrict" }),
  summary: text("summary").notNull(),
  overallConfidence: overallTrustEnum("overall_confidence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow()
}, (table) => [uniqueIndex("note_revisions_note_revision_uidx").on(table.noteId, table.revisionNo)]);

export const noteClaims = pgTable("note_claims", {
  revisionId: uuid("revision_id").notNull().references(() => noteRevisions.id, { onDelete: "cascade" }),
  claimId: uuid("claim_id").notNull().references(() => claims.id, { onDelete: "restrict" }),
  statementSnapshot: text("statement_snapshot").notNull(),
  trustLevelSnapshot: trustLevelEnum("trust_level_snapshot").notNull(),
  displayOrder: integer("display_order").notNull(),
  isKey: boolean("is_key").notNull().default(false)
}, (table) => [primaryKey({ columns: [table.revisionId, table.claimId] })]);

export const userNotes = pgTable("user_notes", {
  id: uuid("id").primaryKey(),
  noteId: uuid("note_id").notNull().references(() => searchNotes.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull(),
  anchorType: noteAnchorEnum("anchor_type").notNull().default("NOTE"),
  anchorId: uuid("anchor_id"),
  body: text("body").notNull(),
  position: integer("position").notNull().default(0),
  ...timestamps
});
