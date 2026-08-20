import { RequestedModeSchema, RunStateSchema, RunTriggerSchema, SearchModeSchema, StopReasonSchema } from "@searchos/domain";
import { z } from "zod";
import { DateTimeSchema, IdSchema, OutputLocaleSchema } from "./common";
import { RunEventTypeSchema } from "./events";

export const CreateSearchTaskInputSchema = z
  .object({
    question: z.string().trim().min(2).max(4000),
    requestedMode: RequestedModeSchema.default("AUTO"),
    outputLocale: OutputLocaleSchema.default("zh-CN")
  })
  .strict();

export const SearchTaskViewSchema = z
  .object({
    id: IdSchema,
    ownerId: IdSchema,
    originalQuestion: z.string().min(1),
    currentQuestion: z.string().min(1),
    outputLocale: OutputLocaleSchema.optional(),
    latestRunId: IdSchema.nullable(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema
  })
  .strict();

export const SearchRunViewSchema = z
  .object({
    id: IdSchema,
    taskId: IdSchema,
    parentRunId: IdSchema.nullable(),
    trigger: RunTriggerSchema,
    requestedMode: RequestedModeSchema,
    outputLocale: OutputLocaleSchema.optional(),
    selectedMode: SearchModeSchema,
    modeConfidence: z.number().min(0).max(1),
    state: RunStateSchema,
    currentStage: RunStateSchema,
    stopReason: StopReasonSchema.nullable(),
    partialReason: z.string().nullable(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
    startedAt: DateTimeSchema,
    completedAt: DateTimeSchema.nullable(),
    cancelledAt: DateTimeSchema.nullable()
  })
  .strict();

export const IntentAssessmentSchema = z
  .object({
    runId: IdSchema,
    normalizedQuestion: z.string().min(1),
    selectedMode: SearchModeSchema,
    modeConfidence: z.number().min(0).max(1),
    entities: z.array(z.string().min(1)),
    constraints: z.record(z.string(), z.string()),
    freshnessRequirement: z.enum(["REALTIME", "RECENT", "VERSIONED", "TIMELESS", "UNKNOWN"]),
    ambiguityNotes: z.array(z.string()),
    assumptions: z.array(z.string()),
    classifierVersion: z.string().min(1)
  })
  .strict();

export const PlanStepSchema = z
  .object({
    id: IdSchema,
    goal: z.string().min(1),
    queryTemplates: z.array(z.string().min(1)).min(1),
    preferredSourceTypes: z.array(z.string().min(1)).min(1),
    completionCriteria: z.array(z.string().min(1)).min(1),
    priority: z.number().int().min(0),
    status: z.enum(["PENDING", "RUNNING", "COMPLETED", "SKIPPED", "FAILED"])
  })
  .strict();

export const SearchPlanSchema = z
  .object({
    id: IdSchema,
    runId: IdSchema,
    version: z.number().int().positive(),
    objective: z.string().min(1),
    steps: z.array(PlanStepSchema).min(1),
    stopConditions: z.array(z.string().min(1)).min(1)
  })
  .strict();

export const RunEventSchema = z
  .object({
    id: IdSchema,
    runId: IdSchema,
    sequence: z.number().int().positive(),
    eventType: RunEventTypeSchema,
    fromState: RunStateSchema.nullable(),
    toState: RunStateSchema,
    summary: z.string().min(1),
    payloadSummary: z.record(z.string(), z.unknown()).default({}),
    createdAt: DateTimeSchema
  })
  .strict();

export type CreateSearchTaskInput = z.infer<typeof CreateSearchTaskInputSchema>;
export type SearchTaskView = z.infer<typeof SearchTaskViewSchema>;
export type SearchRunView = z.infer<typeof SearchRunViewSchema>;
export type IntentAssessment = z.infer<typeof IntentAssessmentSchema>;
export type PlanStep = z.infer<typeof PlanStepSchema>;
export type SearchPlan = z.infer<typeof SearchPlanSchema>;
export type RunEvent = z.infer<typeof RunEventSchema>;
