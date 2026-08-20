import { quickPythonDictBundle } from "@searchos/fixtures";
import { describe, expect, it } from "vitest";
import { calculateOverallConfidence, evaluateClaimTrust } from "./index";

describe("deterministic trust rules", () => {
  it("awards high confidence to direct current primary evidence", () => {
    const claim = quickPythonDictBundle.claims[0]!;
    const summary = evaluateClaimTrust({
      claim,
      links: quickPythonDictBundle.claimEvidence.filter((link) => link.claimId === claim.id),
      conflicts: [], evaluatedAt: "2026-08-12T08:00:00.000Z"
    });
    expect(summary.level).toBe("HIGH");
    expect(summary.reasonCodes).toContain("PRIMARY_SOURCE");
  });

  it("fails closed when a decisive claim has no direct evidence", () => {
    const claim = quickPythonDictBundle.claims[0]!;
    const summary = evaluateClaimTrust({ claim, links: [], conflicts: [], evaluatedAt: "2026-08-12T08:00:00.000Z" });
    expect(summary.level).toBe("INSUFFICIENT");
    expect(calculateOverallConfidence([claim], [summary])).toBe("INSUFFICIENT");
  });

  it("caps an open material conflict below high", () => {
    const claim = quickPythonDictBundle.claims[0]!;
    const summary = evaluateClaimTrust({
      claim, links: quickPythonDictBundle.claimEvidence.filter((link) => link.claimId === claim.id),
      conflicts: [{ id: crypto.randomUUID(), runId: claim.runId, subjectClaimId: claim.id, conflictingClaimId: null, severity: "MATERIAL", status: "OPEN", summary: "Version conflict", claimEvidenceIds: [quickPythonDictBundle.claimEvidence[0]!.id] }],
      evaluatedAt: "2026-08-12T08:00:00.000Z"
    });
    expect(summary.level).toBe("LOW");
  });

  it("returns medium for direct current secondary evidence", () => {
    const claim = quickPythonDictBundle.claims[0]!;
    const link = { ...quickPythonDictBundle.claimEvidence[0]!, authority: "ADEQUATE" as const, primaryContext: "SECONDARY" as const };
    const summary = evaluateClaimTrust({ claim, links: [link], conflicts: [], evaluatedAt: "2026-08-12T08:00:00.000Z" });
    expect(summary.level).toBe("MEDIUM");
    expect(summary.reasonCodes).toContain("ADEQUATE_AUTHORITY");
  });

  it("returns low for weak direct evidence and records staleness", () => {
    const claim = quickPythonDictBundle.claims[0]!;
    const link = { ...quickPythonDictBundle.claimEvidence[0]!, authority: "WEAK" as const, primaryContext: "SECONDARY" as const, freshness: "STALE" as const };
    const summary = evaluateClaimTrust({ claim, links: [link], conflicts: [], evaluatedAt: "2026-08-12T08:00:00.000Z" });
    expect(summary.level).toBe("LOW");
    expect(summary.reasonCodes).toEqual(expect.arrayContaining(["WEAK_AUTHORITY", "STALE_EVIDENCE"]));
  });

  it("returns mixed when decisive claims have different sufficient levels", () => {
    const first = quickPythonDictBundle.claims[0]!;
    const second = { ...quickPythonDictBundle.claims[1]!, importance: "DECISIVE" as const };
    const summaries = [
      { ...quickPythonDictBundle.trustSummaries[0]!, claimId: first.id, level: "HIGH" as const },
      { ...quickPythonDictBundle.trustSummaries[1]!, claimId: second.id, level: "MEDIUM" as const }
    ];
    expect(calculateOverallConfidence([first, second], summaries)).toBe("MIXED");
  });

  it("keeps unknown freshness explicit without inventing a date", () => {
    const claim = quickPythonDictBundle.claims[0]!;
    const link = { ...quickPythonDictBundle.claimEvidence[0]!, freshness: "UNKNOWN" as const };
    const summary = evaluateClaimTrust({ claim, links: [link], conflicts: [], evaluatedAt: "2026-08-12T08:00:00.000Z" });
    expect(summary.level).toBe("HIGH");
    expect(summary.reasonCodes).toContain("FRESHNESS_UNKNOWN");
    expect(summary.explanation).toContain("未提供可验证日期");
  });

  it("stores trust explanations in the requested output locale", () => {
    const claim = quickPythonDictBundle.claims[0]!;
    const link = { ...quickPythonDictBundle.claimEvidence[0]!, freshness: "UNKNOWN" as const };
    const summary = evaluateClaimTrust({
      claim,
      links: [link],
      conflicts: [],
      evaluatedAt: "2026-08-12T08:00:00.000Z",
      outputLocale: "en-US"
    });

    expect(summary.level).toBe("HIGH");
    expect(summary.explanation).toContain("authoritative primary source");
    expect(summary.explanation).toContain("no verifiable date");
  });
});
