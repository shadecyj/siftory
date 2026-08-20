import { describe, expect, it } from "vitest";
import { DomainInvariantError, assertResultInvariants } from "./index";

const baseClaim = {
  id: "claim-1",
  runId: "run-1",
  importance: "DECISIVE" as const,
  trustLevel: "HIGH" as const,
  supportingEvidenceCount: 1,
  hasOpenMaterialConflict: false
};

describe("result domain invariants", () => {
  it("rejects a High decisive Claim without supporting Evidence", () => {
    expect(() => assertResultInvariants({
      runId: "run-1",
      state: "COMPLETED",
      resultClaimIds: ["claim-1"],
      claims: [{ ...baseClaim, supportingEvidenceCount: 0 }]
    })).toThrow(DomainInvariantError);
  });

  it("rejects a High Claim with an unresolved material Conflict", () => {
    expect(() => assertResultInvariants({
      runId: "run-1",
      state: "COMPLETED",
      resultClaimIds: ["claim-1"],
      claims: [{ ...baseClaim, hasOpenMaterialConflict: true }]
    })).toThrow(DomainInvariantError);
  });

  it("rejects Claims owned by another SearchRun", () => {
    expect(() => assertResultInvariants({
      runId: "run-1",
      state: "COMPLETED",
      resultClaimIds: ["claim-1"],
      claims: [{ ...baseClaim, runId: "run-2" }]
    })).toThrow(DomainInvariantError);
  });

  it("rejects dangling StructuredResult Claim references", () => {
    expect(() => assertResultInvariants({
      runId: "run-1",
      state: "COMPLETED",
      resultClaimIds: ["claim-missing"],
      claims: [baseClaim]
    })).toThrow(DomainInvariantError);
  });
});
