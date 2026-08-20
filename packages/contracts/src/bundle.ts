import { assertResultInvariants } from "@searchos/domain";
import { z } from "zod";
import {
  ClaimEvidenceViewSchema,
  ClaimTrustSummarySchema,
  ClaimViewSchema,
  ConflictViewSchema,
  EvidenceViewSchema,
  SourceSnapshotViewSchema,
  SourceViewSchema
} from "./evidence";
import { SearchNoteDraftSchema, SearchNoteViewSchema } from "./note";
import { collectStructuredResultClaimIds, StructuredResultSchema } from "./result";
import {
  IntentAssessmentSchema,
  RunEventSchema,
  SearchPlanSchema,
  SearchRunViewSchema,
  SearchTaskViewSchema
} from "./search";

export const SearchBundleSchema = z
  .object({
    task: SearchTaskViewSchema,
    run: SearchRunViewSchema,
    intent: IntentAssessmentSchema,
    plan: SearchPlanSchema,
    sources: z.array(SourceViewSchema),
    snapshots: z.array(SourceSnapshotViewSchema),
    evidence: z.array(EvidenceViewSchema),
    claims: z.array(ClaimViewSchema),
    claimEvidence: z.array(ClaimEvidenceViewSchema),
    trustSummaries: z.array(ClaimTrustSummarySchema),
    conflicts: z.array(ConflictViewSchema),
    result: StructuredResultSchema,
    noteDraft: SearchNoteDraftSchema,
    savedNote: SearchNoteViewSchema,
    events: z.array(RunEventSchema)
  })
  .strict()
  .superRefine((bundle, context) => {
    const sourceIds = new Set(bundle.sources.map((source) => source.id));
    const snapshotById = new Map(bundle.snapshots.map((snapshot) => [snapshot.id, snapshot]));
    const evidenceById = new Map(bundle.evidence.map((item) => [item.id, item]));
    const claimById = new Map(bundle.claims.map((claim) => [claim.id, claim]));
    const trustByClaim = new Map(bundle.trustSummaries.map((summary) => [summary.claimId, summary]));

    if (bundle.task.latestRunId !== bundle.run.id || bundle.run.taskId !== bundle.task.id) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "SearchTask and SearchRun links are inconsistent." });
    }

    for (const snapshot of bundle.snapshots) {
      if (!sourceIds.has(snapshot.sourceId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `Snapshot ${snapshot.id} references a missing Source.` });
      }
    }

    for (const item of bundle.evidence) {
      if (!snapshotById.has(item.snapshotId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `Evidence ${item.id} references a missing Snapshot.` });
      }
    }

    for (const link of bundle.claimEvidence) {
      if (!claimById.has(link.claimId) || !evidenceById.has(link.evidenceId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `ClaimEvidence ${link.id} contains a dangling reference.` });
      }
    }

    for (const sourceId of bundle.result.sourceIds) {
      if (!sourceIds.has(sourceId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `StructuredResult references missing Source ${sourceId}.` });
      }
    }

    if (new Set(bundle.result.sourceIds).size !== bundle.result.sourceIds.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "StructuredResult source IDs must be deduplicated." });
    }

    const invariantClaims = bundle.claims.map((claim) => {
      const trust = trustByClaim.get(claim.id);
      return {
        id: claim.id,
        runId: claim.runId,
        importance: claim.importance,
        trustLevel: trust?.level ?? "INSUFFICIENT",
        supportingEvidenceCount: trust?.supportingEvidenceCount ?? 0,
        hasOpenMaterialConflict: trust?.unresolvedMaterialConflict ?? false
      };
    });

    try {
      assertResultInvariants({
        runId: bundle.run.id,
        state: bundle.run.state,
        resultClaimIds: collectStructuredResultClaimIds(bundle.result),
        claims: invariantClaims
      });
    } catch (error) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: error instanceof Error ? error.message : "Invalid result." });
    }

    if (bundle.noteDraft.sourceRunId !== bundle.run.id || bundle.savedNote.sourceRunId !== bundle.run.id) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "SearchNote must retain its source SearchRun provenance." });
    }
  });

export type SearchBundle = z.infer<typeof SearchBundleSchema>;
