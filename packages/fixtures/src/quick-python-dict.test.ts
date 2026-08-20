import { SearchBundleSchema, collectStructuredResultClaimIds } from "@searchos/contracts";
import { describe, expect, it } from "vitest";
import { quickPythonDictBundle, quickPythonDictInsufficientBundle, quickPythonDictPartialBundle } from "./index";

describe("Quick Python dict fixture", () => {
  it("passes its full boundary and domain validation", () => {
    expect(SearchBundleSchema.safeParse(quickPythonDictBundle).success).toBe(true);
  });

  it("survives complete JSON serialization", () => {
    const restored: unknown = JSON.parse(JSON.stringify(quickPythonDictBundle));
    expect(SearchBundleSchema.parse(restored)).toEqual(quickPythonDictBundle);
  });

  it("contains only answer claims owned by the current run", () => {
    const answerClaimIds = collectStructuredResultClaimIds(quickPythonDictBundle.result);
    const currentRunClaims = new Set(
      quickPythonDictBundle.claims
        .filter((claim) => claim.runId === quickPythonDictBundle.run.id)
        .map((claim) => claim.id)
    );
    expect(answerClaimIds.every((id) => currentRunClaims.has(id))).toBe(true);
  });

  it("counts deduplicated sources", () => {
    expect(new Set(quickPythonDictBundle.result.sourceIds).size).toBe(2);
    expect(quickPythonDictBundle.sources.filter((source) => source.isOfficial)).toHaveLength(2);
  });

  it("keeps Partial and Insufficient UI states contract-driven", () => {
    expect(quickPythonDictPartialBundle.run.state).toBe("PARTIAL");
    expect(quickPythonDictPartialBundle.result.status).toBe("PARTIAL");
    expect(quickPythonDictInsufficientBundle.result.overallConfidence).toBe("INSUFFICIENT");
    expect(quickPythonDictInsufficientBundle.trustSummaries.find((item) => item.claimId === quickPythonDictInsufficientBundle.result.decisiveClaimIds[0])?.supportingEvidenceCount).toBe(0);
    expect(SearchBundleSchema.safeParse(quickPythonDictInsufficientBundle).success).toBe(true);
  });

});
