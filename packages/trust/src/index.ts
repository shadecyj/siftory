import type { ClaimEvidenceView, ClaimTrustSummary, ClaimView, ConflictView, OutputLocale } from "@searchos/contracts";
import type { OverallTrust, TrustLevel } from "@searchos/domain";

export const TRUST_RULESET_VERSION = "trust-rules-v1";

export interface TrustEvaluationInput {
  readonly claim: ClaimView;
  readonly links: readonly ClaimEvidenceView[];
  readonly conflicts: readonly ConflictView[];
  readonly evaluatedAt: string;
  /**
   * Trust levels and reason codes are language-neutral. The stored explanation
   * follows the search output locale so saved notes and exports stay coherent.
   */
  readonly outputLocale?: OutputLocale;
}

function localizedText(outputLocale: OutputLocale | undefined, chinese: string, english: string): string {
  return outputLocale === "en-US" ? english : chinese;
}

export function evaluateClaimTrust(input: TrustEvaluationInput): ClaimTrustSummary {
  const supporting = input.links.filter((link) => link.stance === "SUPPORTS" || link.stance === "QUALIFIES");
  const contradicting = input.links.filter((link) => link.stance === "CONTRADICTS");
  const direct = supporting.filter((link) => link.relevance === "DIRECT");
  const strongPrimary = direct.filter((link) => link.authority === "STRONG" && link.primaryContext === "PRIMARY" && link.freshness !== "STALE");
  const independentSupportCount = new Set(supporting.map((link) => link.independenceGroup)).size;
  const primarySourceCount = supporting.filter((link) => link.primaryContext === "PRIMARY").length;
  const materialConflict = input.conflicts.some((conflict) => conflict.subjectClaimId === input.claim.id && conflict.severity === "MATERIAL" && conflict.status === "OPEN");
  const reasonCodes: string[] = [];
  let level: TrustLevel;

  if (supporting.length === 0 || direct.length === 0) {
    level = "INSUFFICIENT";
    reasonCodes.push("NO_DIRECT_EVIDENCE");
  } else if (materialConflict || contradicting.length > 0) {
    level = materialConflict ? "LOW" : "MEDIUM";
    reasonCodes.push(materialConflict ? "OPEN_MATERIAL_CONFLICT" : "CONTRADICTING_EVIDENCE");
  } else if (strongPrimary.length > 0) {
    level = "HIGH";
    reasonCodes.push("DIRECT_EVIDENCE", "PRIMARY_SOURCE", "STRONG_AUTHORITY");
  } else if (direct.some((link) => link.authority !== "WEAK") || independentSupportCount >= 2) {
    level = "MEDIUM";
    reasonCodes.push("DIRECT_EVIDENCE", independentSupportCount >= 2 ? "INDEPENDENT_SUPPORT" : "ADEQUATE_AUTHORITY");
  } else {
    level = "LOW";
    reasonCodes.push("WEAK_AUTHORITY");
  }
  if (supporting.some((link) => link.freshness === "STALE")) reasonCodes.push("STALE_EVIDENCE");
  else if (supporting.some((link) => link.freshness === "UNKNOWN")) reasonCodes.push("FRESHNESS_UNKNOWN");
  else if (supporting.some((link) => link.freshness === "CURRENT" || link.freshness === "ACCEPTABLE")) reasonCodes.push("FRESHNESS_VERIFIED");
  if (!materialConflict && contradicting.length === 0) reasonCodes.push("NO_MATERIAL_CONFLICT");

  const freshnessUnknown = supporting.some((link) => link.freshness === "UNKNOWN");
  const explanation = level === "HIGH"
    ? freshnessUnknown
      ? localizedText(input.outputLocale, "权威第一方来源直接支持该结论；来源未提供可验证日期，时效性未额外加分。", "An authoritative primary source directly supports this claim; no verifiable date was available, so freshness received no additional credit.")
      : localizedText(input.outputLocale, "直接证据来自当前、权威且与该结论相符的第一方来源。", "Direct evidence comes from a current, authoritative primary source that supports this claim.")
    : level === "MEDIUM"
      ? localizedText(input.outputLocale, "已有直接支持，但来源强度、独立验证或冲突情况仍限制置信度。", "There is direct support, but source strength, independent verification, or conflicting evidence still limits confidence.")
      : level === "LOW"
        ? localizedText(input.outputLocale, "存在支持证据，但来源较弱或仍有未解决的实质冲突。", "There is supporting evidence, but it is weak or a material conflict remains unresolved.")
        : localizedText(input.outputLocale, "尚未找到可定位、可核验并直接支持该结论的证据。", "No locatable, verifiable evidence directly supporting this claim has been found yet.");

  return {
    claimId: input.claim.id, level, supportingEvidenceCount: supporting.length,
    contradictingEvidenceCount: contradicting.length, independentSupportCount, primarySourceCount,
    reasonCodes: [...new Set(reasonCodes)], explanation, unresolvedMaterialConflict: materialConflict,
    rulesetVersion: TRUST_RULESET_VERSION, evaluatedAt: input.evaluatedAt
  };
}

export function calculateOverallConfidence(claims: readonly ClaimView[], summaries: readonly ClaimTrustSummary[]): OverallTrust {
  const byClaim = new Map(summaries.map((summary) => [summary.claimId, summary.level]));
  const decisive = claims.filter((claim) => claim.importance === "DECISIVE");
  const key = claims.filter((claim) => claim.importance === "KEY");
  const relevant = decisive.length > 0 ? decisive : key;
  const levels = relevant.map((claim) => byClaim.get(claim.id) ?? "INSUFFICIENT");
  if (levels.length === 0 || levels.includes("INSUFFICIENT")) return "INSUFFICIENT";
  if (levels.includes("LOW")) return "LOW";
  const distinct = new Set(levels);
  if (distinct.size > 1) return "MIXED";
  return levels[0] ?? "INSUFFICIENT";
}
