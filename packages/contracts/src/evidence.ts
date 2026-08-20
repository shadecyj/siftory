import {
  AuthoritySchema,
  ClaimImportanceSchema,
  ClaimStatusSchema,
  ClaimTypeSchema,
  ConflictSeveritySchema,
  ConflictStatusSchema,
  EvidenceRelevanceSchema,
  EvidenceStanceSchema,
  EvidenceTypeSchema,
  FreshnessSchema,
  PrimaryContextSchema,
  SourceTypeSchema,
  TrustLevelSchema
} from "@searchos/domain";
import { z } from "zod";
import { DateTimeSchema, IdSchema, LocatorSchema, UrlSchema } from "./common";

export const SourceViewSchema = z
  .object({
    id: IdSchema,
    canonicalUrl: UrlSchema,
    title: z.string().min(1),
    publisher: z.string().min(1),
    domain: z.string().min(1),
    sourceType: SourceTypeSchema,
    publishedAt: DateTimeSchema.nullable(),
    updatedAtSource: DateTimeSchema.nullable(),
    accessedAt: DateTimeSchema,
    language: z.string().min(2),
    isOfficial: z.boolean()
  })
  .strict();

export const SourceSnapshotViewSchema = z
  .object({
    id: IdSchema,
    sourceId: IdSchema,
    fetchedAt: DateTimeSchema,
    contentHash: z.string().min(8),
    contentType: z.string().min(1),
    versionLabel: z.string().nullable(),
    parseStatus: z.enum(["PARSED", "PARTIAL", "FAILED", "BLOCKED"]),
    parserVersion: z.string().min(1)
  })
  .strict();

export const EvidenceViewSchema = z
  .object({
    id: IdSchema,
    snapshotId: IdSchema,
    evidenceType: EvidenceTypeSchema,
    excerpt: z.string().min(1).max(1200),
    paraphrase: z.string().min(1),
    locator: LocatorSchema,
    evidenceHash: z.string().min(8),
    extractionMethod: z.enum(["MODEL", "PARSER", "USER"]),
    extractorVersion: z.string().min(1),
    language: z.string().min(2)
  })
  .strict();

export const ClaimViewSchema = z
  .object({
    id: IdSchema,
    runId: IdSchema,
    statement: z.string().min(1),
    normalizedStatement: z.string().min(1),
    claimType: ClaimTypeSchema,
    importance: ClaimImportanceSchema,
    status: ClaimStatusSchema,
    scope: z.record(z.string(), z.string())
  })
  .strict();

export const ClaimEvidenceViewSchema = z
  .object({
    id: IdSchema,
    claimId: IdSchema,
    evidenceId: IdSchema,
    stance: EvidenceStanceSchema,
    relevance: EvidenceRelevanceSchema,
    authority: AuthoritySchema,
    primaryContext: PrimaryContextSchema,
    freshness: FreshnessSchema,
    independenceGroup: z.string().min(1),
    assessmentNotes: z.array(z.string().min(1)).min(1),
    evaluatorVersion: z.string().min(1),
    assessedAt: DateTimeSchema
  })
  .strict();

export const ClaimTrustSummarySchema = z
  .object({
    claimId: IdSchema,
    level: TrustLevelSchema,
    supportingEvidenceCount: z.number().int().nonnegative(),
    contradictingEvidenceCount: z.number().int().nonnegative(),
    independentSupportCount: z.number().int().nonnegative(),
    primarySourceCount: z.number().int().nonnegative(),
    reasonCodes: z.array(z.string().min(1)),
    explanation: z.string().min(1),
    unresolvedMaterialConflict: z.boolean(),
    rulesetVersion: z.string().min(1),
    evaluatedAt: DateTimeSchema
  })
  .strict();

export const ConflictViewSchema = z
  .object({
    id: IdSchema,
    runId: IdSchema,
    subjectClaimId: IdSchema,
    conflictingClaimId: IdSchema.nullable(),
    severity: ConflictSeveritySchema,
    status: ConflictStatusSchema,
    summary: z.string().min(1),
    claimEvidenceIds: z.array(IdSchema).min(1)
  })
  .strict();

export type SourceView = z.infer<typeof SourceViewSchema>;
export type SourceSnapshotView = z.infer<typeof SourceSnapshotViewSchema>;
export type EvidenceView = z.infer<typeof EvidenceViewSchema>;
export type ClaimView = z.infer<typeof ClaimViewSchema>;
export type ClaimEvidenceView = z.infer<typeof ClaimEvidenceViewSchema>;
export type ClaimTrustSummary = z.infer<typeof ClaimTrustSummarySchema>;
export type ConflictView = z.infer<typeof ConflictViewSchema>;
