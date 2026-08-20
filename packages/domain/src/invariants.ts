import type { RunState, TrustLevel } from "./enums";

export class DomainInvariantError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Domain invariants failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    this.name = "DomainInvariantError";
    this.issues = issues;
  }
}

export interface ClaimInvariantInput {
  readonly id: string;
  readonly runId: string;
  readonly importance: "DECISIVE" | "KEY" | "SUPPORTING" | "BACKGROUND";
  readonly trustLevel: TrustLevel;
  readonly supportingEvidenceCount: number;
  readonly hasOpenMaterialConflict: boolean;
}

export interface ResultInvariantInput {
  readonly runId: string;
  readonly state: RunState;
  readonly resultClaimIds: readonly string[];
  readonly claims: readonly ClaimInvariantInput[];
}

export function collectResultInvariantIssues(input: ResultInvariantInput): string[] {
  const issues: string[] = [];
  const claimsById = new Map(input.claims.map((claim) => [claim.id, claim]));

  for (const claim of input.claims) {
    if (claim.runId !== input.runId) {
      issues.push(`Claim ${claim.id} belongs to another SearchRun.`);
    }
    if (claim.importance === "DECISIVE" && claim.supportingEvidenceCount === 0 && claim.trustLevel === "HIGH") {
      issues.push(`Decisive Claim ${claim.id} cannot be HIGH without supporting evidence.`);
    }
    if (claim.hasOpenMaterialConflict && claim.trustLevel === "HIGH") {
      issues.push(`Claim ${claim.id} cannot be HIGH with an unresolved material conflict.`);
    }
  }

  for (const claimId of input.resultClaimIds) {
    if (!claimsById.has(claimId)) {
      issues.push(`StructuredResult references missing Claim ${claimId}.`);
    }
  }

  return issues;
}

export function assertResultInvariants(input: ResultInvariantInput): void {
  const issues = collectResultInvariantIssues(input);
  if (issues.length > 0) {
    throw new DomainInvariantError(issues);
  }
}
