import type { ClaimTrustSummary, ClaimView, SearchBundle, SourceView } from "@searchos/contracts";
import type { Locale } from "./i18n/locale";
import { translate } from "./i18n/translate";

export type SignalTone = "positive" | "caution" | "negative" | "unknown";

export interface ConfidenceSignal {
  readonly dimension: "RELEVANCE" | "AUTHORITY" | "FRESHNESS" | "CROSS_VERIFICATION";
  readonly label: string;
  readonly detail: string;
  readonly tone: SignalTone;
}

export interface SourceSupportSummary {
  readonly sourceId: string;
  readonly level: SearchBundle["result"]["overallConfidence"];
  readonly claimCount: number;
  readonly evidenceCount: number;
  readonly directEvidenceCount: number;
  readonly primaryEvidenceCount: number;
  readonly strongAuthorityCount: number;
  readonly currentEvidenceCount: number;
  readonly contradictingEvidenceCount: number;
}

const importanceRank: Record<ClaimView["importance"], number> = {
  DECISIVE: 0,
  KEY: 1,
  SUPPORTING: 2,
  BACKGROUND: 3
};

export function sortClaimsForDisplay(claims: readonly ClaimView[]): ClaimView[] {
  return claims.map((claim, index) => ({ claim, index }))
    .sort((left, right) => importanceRank[left.claim.importance] - importanceRank[right.claim.importance] || left.index - right.index)
    .map(({ claim }) => claim);
}

export function confidenceLabel(level: SearchBundle["result"]["overallConfidence"], locale: Locale = "en-US"): string {
  return translate(locale, `confidence.${level}` as never);
}

export function epistemicLabel(claim: ClaimView, trust: ClaimTrustSummary | undefined, locale: Locale = "en-US"): { label: string; kind: "fact" | "inference" | "proposal" | "open-question" } {
  if (!trust || trust.level === "INSUFFICIENT") return { label: translate(locale, "claim.openQuestion"), kind: "open-question" };
  if (claim.claimType === "RECOMMENDATION") return { label: translate(locale, "claim.proposal"), kind: "proposal" };
  if (claim.claimType === "COMPARISON") return { label: translate(locale, "claim.inference"), kind: "inference" };
  return { label: translate(locale, "claim.fact"), kind: "fact" };
}

export function buildConfidenceSignals(bundle: Pick<SearchBundle, "claims" | "claimEvidence" | "conflicts" | "result">, locale: Locale = "zh-CN"): ConfidenceSignal[] {
  const relevantIds = new Set(bundle.result.decisiveClaimIds.length > 0 ? bundle.result.decisiveClaimIds : bundle.result.keyClaimIds);
  const links = bundle.claimEvidence.filter((link) => relevantIds.has(link.claimId) && ["SUPPORTS", "QUALIFIES"].includes(link.stance));
  const direct = links.filter((link) => link.relevance === "DIRECT");
  const primary = links.filter((link) => link.primaryContext === "PRIMARY");
  const strong = links.filter((link) => link.authority === "STRONG");
  const knownFreshness = links.filter((link) => link.freshness === "CURRENT" || link.freshness === "ACCEPTABLE");
  const stale = links.filter((link) => link.freshness === "STALE");
  const unknownFreshness = links.filter((link) => link.freshness === "UNKNOWN");
  const independentGroups = new Set(links.map((link) => link.independenceGroup)).size;
  const materialConflicts = bundle.conflicts.filter((conflict) => conflict.severity === "MATERIAL" && conflict.status === "OPEN").length;

  const relevance: ConfidenceSignal = direct.length > 0
    ? { dimension: "RELEVANCE", label: translate(locale, "confidence.relevance"), detail: translate(locale, "confidence.directSupport", { count: direct.length }), tone: "positive" }
    : { dimension: "RELEVANCE", label: translate(locale, "confidence.relevance"), detail: translate(locale, "confidence.noDirectSupport"), tone: "negative" };

  const authority: ConfidenceSignal = primary.length > 0 && strong.length > 0
    ? { dimension: "AUTHORITY", label: translate(locale, "confidence.authority"), detail: translate(locale, "confidence.strongPrimary", { count: primary.length }), tone: "positive" }
    : links.length > 0
      ? { dimension: "AUTHORITY", label: translate(locale, "confidence.authority"), detail: translate(locale, "confidence.secondary"), tone: "caution" }
      : { dimension: "AUTHORITY", label: translate(locale, "confidence.authority"), detail: translate(locale, "confidence.noAuthority"), tone: "unknown" };

  const freshness: ConfidenceSignal = stale.length > 0
    ? { dimension: "FRESHNESS", label: translate(locale, "confidence.freshness"), detail: translate(locale, "confidence.stale", { count: stale.length }), tone: "negative" }
    : knownFreshness.length > 0
      ? { dimension: "FRESHNESS", label: translate(locale, "confidence.freshness"), detail: translate(locale, "confidence.fresh", { count: knownFreshness.length }), tone: "positive" }
      : { dimension: "FRESHNESS", label: translate(locale, "confidence.freshness"), detail: unknownFreshness.length > 0 ? translate(locale, "confidence.unknownDate", { count: unknownFreshness.length }) : translate(locale, "confidence.unknownFreshness"), tone: "unknown" };

  const crossVerification: ConfidenceSignal = materialConflicts > 0
    ? { dimension: "CROSS_VERIFICATION", label: translate(locale, "confidence.crossVerification"), detail: translate(locale, "confidence.conflicts", { count: materialConflicts }), tone: "negative" }
    : independentGroups >= 2
      ? { dimension: "CROSS_VERIFICATION", label: translate(locale, "confidence.crossVerification"), detail: translate(locale, "confidence.crossVerified", { count: independentGroups }), tone: "positive" }
      : { dimension: "CROSS_VERIFICATION", label: translate(locale, "confidence.crossVerification"), detail: translate(locale, "confidence.singleGroup"), tone: "caution" };

  return [relevance, authority, freshness, crossVerification];
}

export function buildSourceSupportSummaries(
  bundle: Pick<SearchBundle, "sources" | "snapshots" | "evidence" | "claimEvidence">
): SourceSupportSummary[] {
  const sourceIdBySnapshot = new Map(bundle.snapshots.map((snapshot) => [snapshot.id, snapshot.sourceId]));
  const sourceIdByEvidence = new Map(bundle.evidence.map((evidence) => [evidence.id, sourceIdBySnapshot.get(evidence.snapshotId)]));

  return bundle.sources.map((source) => {
    const links = bundle.claimEvidence.filter((link) => sourceIdByEvidence.get(link.evidenceId) === source.id && link.relevance !== "UNRELATED");
    const supporting = links.filter((link) => link.stance === "SUPPORTS" || link.stance === "QUALIFIES");
    const contradicting = links.filter((link) => link.stance === "CONTRADICTS");
    const directEvidenceCount = supporting.filter((link) => link.relevance === "DIRECT").length;
    const primaryEvidenceCount = supporting.filter((link) => link.primaryContext === "PRIMARY").length;
    const strongAuthorityCount = supporting.filter((link) => link.authority === "STRONG").length;
    const currentEvidenceCount = supporting.filter((link) => link.freshness === "CURRENT" || link.freshness === "ACCEPTABLE").length;

    let level: SourceSupportSummary["level"] = "INSUFFICIENT";
    if (supporting.length > 0 && contradicting.length > 0) level = "MIXED";
    else if (directEvidenceCount > 0 && strongAuthorityCount > 0 && primaryEvidenceCount > 0) level = "HIGH";
    else if (directEvidenceCount > 0 || strongAuthorityCount > 0 || primaryEvidenceCount > 0) level = "MEDIUM";
    else if (supporting.length > 0) level = "LOW";

    return {
      sourceId: source.id,
      level,
      claimCount: new Set(supporting.map((link) => link.claimId)).size,
      evidenceCount: new Set(supporting.map((link) => link.evidenceId)).size,
      directEvidenceCount,
      primaryEvidenceCount,
      strongAuthorityCount,
      currentEvidenceCount,
      contradictingEvidenceCount: contradicting.length
    };
  });
}

export function sourceSupportLabel(level: SourceSupportSummary["level"], locale: Locale = "zh-CN"): string {
  return translate(locale, ({ HIGH: "source.highSupport", MEDIUM: "source.mediumSupport", LOW: "source.lowSupport", INSUFFICIENT: "source.insufficientSupport", MIXED: "source.mixedSupport" } as const)[level]);
}

export function sourceTypeLabel(source: SourceView, locale: Locale = "zh-CN"): string {
  return translate(locale, ({
    OFFICIAL_DOC: "source.officialDocument",
    GITHUB: "source.github",
    PAPER: "source.paper",
    GOVERNMENT: "source.government",
    ARTICLE: "source.article",
    FORUM: "source.forum",
    OTHER: "source.other"
  } as const)[source.sourceType]);
}

export function sourceDateLabel(source: SourceView, locale: Locale = "zh-CN"): string {
  const date = source.updatedAtSource ?? source.publishedAt;
  if (!date) return translate(locale, "source.dateUnknown");
  return translate(locale, "source.date", { date: new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(new Date(date)) });
}

export function trustExplanation(trust: ClaimTrustSummary | undefined, locale: Locale): string {
  if (!trust) return translate(locale, "claim.noSummary");
  if (trust.reasonCodes.includes("NO_DIRECT_EVIDENCE")) return translate(locale, "trust.insufficient");
  if (trust.level === "HIGH") return translate(locale, trust.reasonCodes.includes("FRESHNESS_UNKNOWN") ? "trust.highFreshnessUnknown" : "trust.highVerified");
  if (trust.level === "MEDIUM") return translate(locale, "trust.medium");
  if (trust.level === "LOW") return translate(locale, trust.reasonCodes.includes("OPEN_MATERIAL_CONFLICT") ? "trust.lowConflict" : "trust.low");
  return trust.explanation || translate(locale, "trust.insufficient");
}
