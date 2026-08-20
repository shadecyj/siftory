import { RequestedModeSchema, RunStateSchema, SearchModeSchema } from "@searchos/domain";
import { z } from "zod";
import { DateTimeSchema, IdSchema, OutputLocaleSchema, UrlSchema } from "./common";
import { SearchBundleSchema } from "./bundle";
import { RunEventSchema } from "./search";
export { RunEventTypeSchema, type RunEventType } from "./events";

export const RuntimeModeSchema = z.enum(["replay", "live"]);
export const ModelProviderSchema = z.enum(["openai", "deepseek"]);
export const SearchProviderSchema = z.enum(["tavily", "brave"]);
export const RuntimeValidationStateSchema = z.enum([
  "NOT_CONFIGURED",
  "SAVED_UNVERIFIED",
  "TESTING",
  "VERIFIED",
  "FAILED"
]);
export const RuntimeLifecycleStateSchema = z.enum([
  "ACTIVE",
  "RESTART_REQUIRED",
  "RESTARTING",
  "ROLLBACK",
  "REPLAY_FALLBACK"
]);

/**
 * Safe runtime metadata intended for UI and HTTP responses. Credentials are
 * deliberately absent from this schema and must never be added to it.
 */
export const RuntimeProfileStatusSchema = z.object({
  runtimeMode: RuntimeModeSchema,
  searchProvider: SearchProviderSchema.nullable(),
  modelProvider: ModelProviderSchema.nullable(),
  model: z.string().min(1).nullable(),
  modelBaseUrl: UrlSchema.nullable(),
  searchKeyConfigured: z.boolean(),
  modelKeyConfigured: z.boolean(),
  validationState: RuntimeValidationStateSchema,
  lifecycleState: RuntimeLifecycleStateSchema,
  restartRequired: z.boolean(),
  activeRunCount: z.number().int().nonnegative(),
  lastValidatedAt: DateTimeSchema.nullable(),
  publicFailureCode: z.string().min(1).nullable(),
  revision: z.number().int().nonnegative()
}).strict();

export const RuntimeProfileStatusResponseSchema = z.object({
  profile: RuntimeProfileStatusSchema,
  /**
   * Describes where configuration is safely managed. It is intentionally not
   * inferred from a credential value.
   */
  configurationSurface: z.enum(["environment", "desktop"])
}).strict();
export const SearchQueryViewSchema = z.object({
  id: IdSchema, runId: IdSchema, stepId: IdSchema.nullable(), query: z.string().min(1),
  round: z.number().int().positive(), provider: z.string().min(1), language: z.string().min(2),
  freshness: z.string().nullable(), queryHash: z.string().min(8), createdAt: DateTimeSchema
}).strict();

export const RetrievalAttemptViewSchema = z.object({
  id: IdSchema, queryId: IdSchema, status: z.enum(["RUNNING", "COMPLETED", "FAILED", "RATE_LIMITED", "CANCELLED"]),
  candidateCount: z.number().int().nonnegative(), startedAt: DateTimeSchema, completedAt: DateTimeSchema.nullable(),
  errorCode: z.string().nullable()
}).strict();

export const ExcludedSourceViewSchema = z.object({
  id: IdSchema, runId: IdSchema, url: UrlSchema, stage: z.enum(["DISCOVERY", "FETCH", "PARSE", "EXTRACTION", "EVALUATION"]),
  reasonCode: z.string().min(1), publicSummary: z.string().min(1), createdAt: DateTimeSchema
}).strict();

export const SourceBlockSchema = z.object({
  id: z.string().min(1), kind: z.enum(["HEADING", "PARAGRAPH", "CODE", "LIST_ITEM"]),
  headingPath: z.array(z.string()), paragraph: z.number().int().positive(), text: z.string().min(1)
}).strict();

export const ParsedSourceDocumentSchema = z.object({
  snapshotId: IdSchema, title: z.string().min(1), normalizedText: z.string().min(1),
  blocks: z.array(SourceBlockSchema).min(1), truncated: z.boolean(), parserVersion: z.string().min(1)
}).strict();

export const PassageCandidateSchema = z.object({
  snapshotId: IdSchema, blockId: z.string().min(1), headingPath: z.array(z.string()),
  text: z.string().min(1), score: z.number().min(0).max(1)
}).strict();

export const ApiErrorCodeSchema = z.enum([
  "INVALID_REQUEST", "NOT_FOUND", "PROVIDER_NOT_CONFIGURED", "MODE_NOT_AVAILABLE", "QUERY_TOO_BROAD", "SEARCH_RATE_LIMITED",
  "SEARCH_PROVIDER_FAILED", "NO_SEARCH_RESULTS", "FETCH_BLOCKED", "FETCH_TIMEOUT", "UNSUPPORTED_CONTENT_TYPE",
  "NO_FETCHABLE_SOURCES", "MODEL_RATE_LIMITED", "MODEL_PROVIDER_FAILED", "MODEL_OUTPUT_INVALID", "NO_VERIFIABLE_EVIDENCE",
  "RUN_CANCELLED", "PROCESS_INTERRUPTED", "INTERNAL_PIPELINE_ERROR"
]);

export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema, stage: RunStateSchema.nullable(), retryable: z.boolean(), publicMessage: z.string().min(1),
    retainedObjectCounts: z.record(z.string(), z.number().int().nonnegative())
  }).strict()
}).strict();

const SearchQuestionSchema = z.string().trim().min(2).max(4000).superRefine((question, context) => {
  if (/\b(?:file|data|javascript|ftp):\/\//i.test(question) || /https?:\/\/(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|\[::1\])/i.test(question)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Search questions cannot contain private or unsafe URLs." });
  }
});

export const CreateSearchRequestSchema = z.object({
  question: SearchQuestionSchema,
  requestedMode: RequestedModeSchema.default("AUTO"),
  outputLocale: OutputLocaleSchema.default("zh-CN")
}).strict();

export const CreateSearchResponseSchema = z.object({
  taskId: IdSchema, runId: IdSchema, selectedMode: SearchModeSchema, runtimeMode: RuntimeModeSchema,
  eventsUrl: z.string().min(1),
  outputLocale: OutputLocaleSchema.optional()
}).strict();

export const RunSnapshotResponseSchema = z.object({
  runtimeMode: RuntimeModeSchema,
  provider: z.string().min(1),
  bundle: SearchBundleSchema,
  queries: z.array(SearchQueryViewSchema),
  retrievalAttempts: z.array(RetrievalAttemptViewSchema),
  excludedSources: z.array(ExcludedSourceViewSchema),
  availableActions: z.array(z.enum(["CANCEL", "RETRY", "SAVE", "EDIT_QUERY"]))
}).strict();

export const RuntimeRunStatusSchema = z.enum(["QUEUED", "RUNNING", "COMPLETED", "PARTIAL", "FAILED", "CANCELLED"]);
export const RuntimeRunResponseSchema = z.object({
  taskId: IdSchema, runId: IdSchema, runtimeMode: RuntimeModeSchema, provider: z.string().min(1),
  outputLocale: OutputLocaleSchema.optional(),
  status: RuntimeRunStatusSchema, currentStage: RunStateSchema, events: z.array(RunEventSchema),
  bundle: SearchBundleSchema.nullable(), queries: z.array(SearchQueryViewSchema),
  retrievalAttempts: z.array(RetrievalAttemptViewSchema), excludedSources: z.array(ExcludedSourceViewSchema),
  error: ApiErrorResponseSchema.shape.error.nullable(), availableActions: z.array(z.enum(["CANCEL", "RETRY", "SAVE", "EDIT_QUERY"]))
}).strict();

export type RuntimeMode = z.infer<typeof RuntimeModeSchema>;
export type ModelProvider = z.infer<typeof ModelProviderSchema>;
export type SearchProviderKind = z.infer<typeof SearchProviderSchema>;
export type RuntimeValidationState = z.infer<typeof RuntimeValidationStateSchema>;
export type RuntimeLifecycleState = z.infer<typeof RuntimeLifecycleStateSchema>;
export type RuntimeProfileStatus = z.infer<typeof RuntimeProfileStatusSchema>;
export type RuntimeProfileStatusResponse = z.infer<typeof RuntimeProfileStatusResponseSchema>;
export type SearchQueryView = z.infer<typeof SearchQueryViewSchema>;
export type RetrievalAttemptView = z.infer<typeof RetrievalAttemptViewSchema>;
export type ExcludedSourceView = z.infer<typeof ExcludedSourceViewSchema>;
export type SourceBlock = z.infer<typeof SourceBlockSchema>;
export type ParsedSourceDocument = z.infer<typeof ParsedSourceDocumentSchema>;
export type PassageCandidate = z.infer<typeof PassageCandidateSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
export type CreateSearchRequest = z.infer<typeof CreateSearchRequestSchema>;
export type CreateSearchResponse = z.infer<typeof CreateSearchResponseSchema>;
export type RunSnapshotResponse = z.infer<typeof RunSnapshotResponseSchema>;
export type RuntimeRunStatus = z.infer<typeof RuntimeRunStatusSchema>;
export type RuntimeRunResponse = z.infer<typeof RuntimeRunResponseSchema>;
