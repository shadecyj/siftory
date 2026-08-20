import { ClaimImportanceSchema, ClaimTypeSchema, EvidenceRelevanceSchema, EvidenceStanceSchema, SearchModeSchema } from "@searchos/domain";
import { z } from "zod";

export const QuickIntentOutputSchema = z.object({
  normalizedQuestion: z.string().min(1), selectedMode: SearchModeSchema, modeConfidence: z.number().min(0).max(1),
  entities: z.array(z.string()), constraints: z.record(z.string(), z.string()),
  freshnessRequirement: z.enum(["REALTIME", "RECENT", "VERSIONED", "TIMELESS", "UNKNOWN"]),
  ambiguityNotes: z.array(z.string()), assumptions: z.array(z.string())
}).strict();

export const QuickPlanOutputSchema = z.object({
  objective: z.string().min(1),
  steps: z.array(z.object({
    goal: z.string().min(1), queries: z.array(z.string().min(1)).min(1).max(3),
    preferredSourceTypes: z.array(z.string().min(1)).min(1), completionCriteria: z.array(z.string().min(1)).min(1)
  }).strict()).min(1).max(2),
  stopConditions: z.array(z.string().min(1)).min(1)
}).strict();

export const EvidenceCandidateOutputSchema = z.object({
  snapshotId: z.string().uuid(), blockId: z.string().min(1), exactExcerpt: z.string().min(1).max(1200), paraphrase: z.string().min(1),
  stance: EvidenceStanceSchema, relevance: EvidenceRelevanceSchema
}).strict();

export const ClaimCandidateOutputSchema = z.object({
  statement: z.string().min(1), normalizedStatement: z.string().min(1), claimType: ClaimTypeSchema,
  importance: ClaimImportanceSchema, scope: z.record(z.string(), z.string()), evidence: z.array(EvidenceCandidateOutputSchema).min(1)
}).strict();

export const ClaimEvidenceAssessmentOutputSchema = z.object({
  claimIndex: z.number().int().nonnegative(), evidenceIndex: z.number().int().nonnegative(),
  stance: EvidenceStanceSchema, relevance: EvidenceRelevanceSchema,
  assessmentNotes: z.array(z.string().min(1)).min(1)
}).strict();

export const QuickExtractionOutputSchema = z.object({ claims: z.array(ClaimCandidateOutputSchema).min(1).max(12) }).strict();

export const QuickSynthesisOutputSchema = z.object({
  title: z.string().min(1), summary: z.string().min(1), answer: z.string().min(1),
  bullets: z.array(z.object({ text: z.string().min(1), claimIndexes: z.array(z.number().int().nonnegative()).min(1) }).strict()),
  limitations: z.array(z.string())
}).strict();

export type QuickIntentOutput = z.infer<typeof QuickIntentOutputSchema>;
export type QuickPlanOutput = z.infer<typeof QuickPlanOutputSchema>;
export type EvidenceCandidateOutput = z.infer<typeof EvidenceCandidateOutputSchema>;
export type ClaimCandidateOutput = z.infer<typeof ClaimCandidateOutputSchema>;
export type ClaimEvidenceAssessmentOutput = z.infer<typeof ClaimEvidenceAssessmentOutputSchema>;
export type QuickExtractionOutput = z.infer<typeof QuickExtractionOutputSchema>;
export type QuickSynthesisOutput = z.infer<typeof QuickSynthesisOutputSchema>;
