import { quickPythonDictBundle, quickPythonDictInsufficientBundle } from "@searchos/fixtures";
import { describe, expect, it } from "vitest";
import { buildConfidenceSignals, buildSourceSupportSummaries, confidenceLabel, epistemicLabel, sortClaimsForDisplay, sourceDateLabel, sourceSupportLabel } from "./result-view";

describe("Search result view model", () => {
  it("orders decisive claims before key and supporting claims", () => {
    const claims = [
      { ...quickPythonDictBundle.claims[0]!, importance: "BACKGROUND" as const },
      quickPythonDictBundle.claims[1]!,
      { ...quickPythonDictBundle.claims[0]!, id: crypto.randomUUID(), importance: "DECISIVE" as const }
    ];
    expect(sortClaimsForDisplay(claims).map((claim) => claim.importance)).toEqual(["DECISIVE", "KEY", "BACKGROUND"]);
  });

  it("builds four explainable confidence dimensions without source-count scoring", () => {
    const signals = buildConfidenceSignals(quickPythonDictBundle);
    expect(signals).toHaveLength(4);
    expect(signals.map((signal) => signal.dimension)).toEqual(["RELEVANCE", "AUTHORITY", "FRESHNESS", "CROSS_VERIFICATION"]);
    expect(signals.find((signal) => signal.dimension === "AUTHORITY")?.detail).toContain("第一方证据");
  });

  it("labels unsupported claims as open questions", () => {
    const claim = quickPythonDictInsufficientBundle.claims[0]!;
    const trust = quickPythonDictInsufficientBundle.trustSummaries.find((summary) => summary.claimId === claim.id);
    expect(epistemicLabel(claim, trust)).toEqual({ label: "Open question", kind: "open-question" });
    expect(confidenceLabel(quickPythonDictInsufficientBundle.result.overallConfidence)).toBe("Insufficient evidence");
    expect(confidenceLabel("MIXED")).toBe("Mixed confidence");
  });

  it("keeps missing source dates unknown", () => {
    expect(sourceDateLabel({ ...quickPythonDictBundle.sources[0]!, publishedAt: null, updatedAtSource: null })).toBe("发布日期未知");
  });

  it("explains each source only in the context of the claims it supports", () => {
    const summaries = buildSourceSupportSummaries(quickPythonDictBundle);
    expect(summaries).toHaveLength(quickPythonDictBundle.sources.length);
    expect(summaries[0]).toMatchObject({ level: "HIGH", claimCount: 1, evidenceCount: 1, directEvidenceCount: 1 });
    expect(sourceSupportLabel(summaries[0]!.level)).toBe("高支持");
  });
});
