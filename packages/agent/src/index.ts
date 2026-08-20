import { createHash, randomUUID } from "node:crypto";
import {
  QuickExtractionOutputSchema, QuickIntentOutputSchema, QuickPlanOutputSchema, QuickSynthesisOutputSchema,
  type ClaimEvidenceView, type ClaimView, type ConflictView, type EvidenceView, type ExcludedSourceView,
  type IntentAssessment, type ParsedSourceDocument, type RetrievalAttemptView, type RunEvent,
  type OutputLocale, type SearchPlan, type SearchQueryView, type SourceSnapshotView, type SourceView
} from "@searchos/contracts";
import type { ContentFetcher, ModelGateway, RequestedMode, RunState, RunTrigger, SearchProvider, SourceCandidate } from "@searchos/domain";
import { buildQuickSearchBundle } from "@searchos/presentation";
import { canonicalizeUrl, parseHtmlDocument, selectPassages, verifyExactAnchor } from "@searchos/retrieval";
import { calculateOverallConfidence, evaluateClaimTrust } from "@searchos/trust";

const stringArray = { type: "array", items: { type: "string" } } as const;
const stringRecord = { type: "object", additionalProperties: { type: "string" } } as const;
const schemas = {
  intent: {
    type: "object", additionalProperties: false,
    properties: {
      normalizedQuestion: { type: "string" }, selectedMode: { type: "string", enum: ["QUICK", "COMPARE", "RESEARCH"] },
      modeConfidence: { type: "number", minimum: 0, maximum: 1 }, entities: stringArray, constraints: stringRecord,
      freshnessRequirement: { type: "string", enum: ["REALTIME", "RECENT", "VERSIONED", "TIMELESS", "UNKNOWN"] },
      ambiguityNotes: stringArray, assumptions: stringArray
    },
    required: ["normalizedQuestion", "selectedMode", "modeConfidence", "entities", "constraints", "freshnessRequirement", "ambiguityNotes", "assumptions"]
  },
  plan: {
    type: "object", additionalProperties: false,
    properties: {
      objective: { type: "string" },
      steps: { type: "array", minItems: 1, maxItems: 2, items: { type: "object", additionalProperties: false, properties: { goal: { type: "string" }, queries: stringArray, preferredSourceTypes: stringArray, completionCriteria: stringArray }, required: ["goal", "queries", "preferredSourceTypes", "completionCriteria"] } },
      stopConditions: stringArray
    }, required: ["objective", "steps", "stopConditions"]
  },
  extraction: {
    type: "object", additionalProperties: false,
    properties: {
      claims: { type: "array", minItems: 1, maxItems: 12, items: { type: "object", additionalProperties: false, properties: {
        statement: { type: "string" }, normalizedStatement: { type: "string" }, claimType: { type: "string", enum: ["FACT", "CAPABILITY", "COMPARISON", "RECOMMENDATION", "DEFINITION", "PROCEDURE"] },
        importance: { type: "string", enum: ["DECISIVE", "KEY", "SUPPORTING", "BACKGROUND"] }, scope: stringRecord,
        evidence: { type: "array", minItems: 1, items: { type: "object", additionalProperties: false, properties: {
          snapshotId: { type: "string", format: "uuid" }, blockId: { type: "string" }, exactExcerpt: { type: "string" }, paraphrase: { type: "string" },
          stance: { type: "string", enum: ["SUPPORTS", "CONTRADICTS", "QUALIFIES", "CONTEXTUAL"] }, relevance: { type: "string", enum: ["DIRECT", "PARTIAL", "CONTEXTUAL", "UNRELATED"] }
        }, required: ["snapshotId", "blockId", "exactExcerpt", "paraphrase", "stance", "relevance"] } }
      }, required: ["statement", "normalizedStatement", "claimType", "importance", "scope", "evidence"] } }
    }, required: ["claims"]
  },
  synthesis: {
    type: "object", additionalProperties: false,
    properties: {
      title: { type: "string" }, summary: { type: "string" }, answer: { type: "string" },
      bullets: { type: "array", items: { type: "object", additionalProperties: false, properties: { text: { type: "string" }, claimIndexes: { type: "array", items: { type: "integer", minimum: 0 } } }, required: ["text", "claimIndexes"] } },
      limitations: stringArray
    }, required: ["title", "summary", "answer", "bullets", "limitations"]
  }
} as const;

export class QuickAgentError extends Error {
  constructor(readonly code: "MODE_NOT_AVAILABLE" | "QUERY_TOO_BROAD" | "NO_SEARCH_RESULTS" | "NO_FETCHABLE_SOURCES" | "NO_VERIFIABLE_EVIDENCE", message: string) {
    super(message); this.name = "QuickAgentError";
  }
}

export interface QuickAgentDependencies {
  readonly searchProvider: SearchProvider;
  readonly contentFetcher: ContentFetcher;
  readonly modelGateway: ModelGateway;
}

export interface QuickAgentInput {
  readonly question: string;
  readonly requestedMode: RequestedMode;
  /**
   * The language requested for generated claims, synthesis and new
   * user-facing output. Evidence excerpts remain in the source language.
   */
  readonly outputLocale?: OutputLocale;
  readonly parentRunId?: string | null;
  readonly trigger?: RunTrigger;
  readonly ownerId?: string;
  readonly maxSources?: number;
  readonly signal?: AbortSignal;
  readonly ids?: { readonly task: string; readonly run: string; readonly owner: string; readonly note: string };
  readonly onEvent?: (event: RunEvent) => void;
}

export interface QuickAgentResult {
  readonly bundle: ReturnType<typeof buildQuickSearchBundle>;
  readonly queries: readonly SearchQueryView[];
  readonly retrievalAttempts: readonly RetrievalAttemptView[];
  readonly documents: readonly ParsedSourceDocument[];
  readonly excludedSources: readonly ExcludedSourceView[];
}

function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function hostname(url: string): string { return new URL(url).hostname.toLowerCase(); }
function isOfficial(candidate: SourceCandidate): boolean { return /(^|\.)(gov|edu)(\.|$)/.test(hostname(candidate.url)) || /docs\.|developer\.|official/i.test(candidate.url); }
function isTooBroadQuestion(question: string): boolean {
  const normalized = question.trim().replace(/[？?。.!！]+$/g, "");
  const hasSpecificIntent = /(?:怎么|如何|为什么|是什么|区别|是否|能否|何时|哪里|多少|教程|配置|实现|报错|版本|API|\bhow\b|\bwhat\b|\bwhy\b|\bwhich\b|\bcan\b|\bdoes\b)/i.test(normalized);
  if (hasSpecificIntent) return false;
  const latinWords = normalized.match(/[A-Za-z0-9_.+-]+/g)?.length ?? 0;
  return normalized.length <= 6 || (latinWords > 0 && latinWords <= 2 && normalized.length <= 20) || /^(?:介绍|讲讲|说说|分析|研究|总结|了解)(?:一下)?[^，,]{0,12}$/u.test(normalized);
}

function outputLanguageInstruction(outputLocale: OutputLocale): string {
  return outputLocale === "en-US"
    ? "Generate all synthesized fields, plans, claims, paraphrases, and limitations in English. Preserve exact evidence excerpts exactly as supplied."
    : "请使用简体中文生成计划、结论、释义、摘要和限制说明。必须逐字保留输入中的原文证据摘录，不得翻译或改写 exact excerpts。";
}

/**
 * System-authored run records are saved alongside generated claims and notes.
 * Keep them in the requested output language as well; source excerpts remain
 * untouched because they are evidence, not generated copy.
 */
function localizedText(outputLocale: OutputLocale, chinese: string, english: string): string {
  return outputLocale === "en-US" ? english : chinese;
}

export async function runQuickSearch(input: QuickAgentInput, dependencies: QuickAgentDependencies): Promise<QuickAgentResult> {
  const outputLocale = input.outputLocale ?? "zh-CN";
  const message = (chinese: string, english: string) => localizedText(outputLocale, chinese, english);
  const now = new Date().toISOString();
  const ids = input.ids ?? { task: randomUUID(), run: randomUUID(), owner: input.ownerId ?? "00000000-0000-7000-8000-000000000001", note: randomUUID() };
  const events: RunEvent[] = [];
  let sequence = 0;
  let previous: RunState | null = null;
  const emit = (toState: RunState, summary: string, eventType: RunEvent["eventType"], payloadSummary: Record<string, unknown> = {}) => {
    const event: RunEvent = { id: randomUUID(), runId: ids.run, sequence: ++sequence, eventType, fromState: previous, toState, summary, payloadSummary, createdAt: new Date().toISOString() };
    events.push(event);
    input.onEvent?.(event);
    previous = toState;
  };
  emit("CREATED", message("搜索任务已创建。", "Search run created."), "RUN_CREATED");
  emit("UNDERSTANDING", message("正在识别问题意图与搜索模式。", "Understanding the question and selecting a search mode."), "RUN_UNDERSTANDING");
  if (isTooBroadQuestion(input.question)) {
    throw new QuickAgentError("QUERY_TOO_BROAD", message("问题范围过宽。请加入具体目标、对象、版本或时间范围后重试。", "The question is too broad. Add a concrete goal, object, version, or time range and try again."));
  }
  const intentOutput = (await dependencies.modelGateway.generateStructured({
    operation: "quick-intent", promptVersion: "quick-intent-v2", systemInstruction: `Classify the search task and return structured data. ${outputLanguageInstruction(outputLocale)}`,
    input: JSON.stringify({ question: input.question, requestedMode: input.requestedMode }), outputSchemaName: "quick_intent",
    outputJsonSchema: schemas.intent, parse: (value) => QuickIntentOutputSchema.parse(value), maxOutputTokens: 800, ...(input.signal ? { signal: input.signal } : {})
  })).data;
  if (intentOutput.selectedMode !== "QUICK" && input.requestedMode !== "QUICK") throw new QuickAgentError("MODE_NOT_AVAILABLE", message(`当前 Alpha 尚未开放 ${intentOutput.selectedMode}。`, `${intentOutput.selectedMode} is not available in the current Alpha.`));
  const intent: IntentAssessment = { ...intentOutput, runId: ids.run, selectedMode: "QUICK", classifierVersion: "quick-intent-v2" };
  emit("UNDERSTANDING", message("已识别为 Quick 搜索。", "Classified as a Quick search."), "INTENT_COMPLETED", { selectedMode: "QUICK" });
  emit("PLANNING", message("正在生成官方来源优先的搜索计划。", "Creating a search plan that prioritizes official sources."), "RUN_PLANNING");
  const planOutput = (await dependencies.modelGateway.generateStructured({
    operation: "quick-plan", promptVersion: "quick-plan-v2", systemInstruction: `Create a compact evidence-first web search plan. ${outputLanguageInstruction(outputLocale)}`,
    input: JSON.stringify(intentOutput), outputSchemaName: "quick_plan", outputJsonSchema: schemas.plan,
    parse: (value) => QuickPlanOutputSchema.parse(value), maxOutputTokens: 1200, ...(input.signal ? { signal: input.signal } : {})
  })).data;
  const plan: SearchPlan = {
    id: randomUUID(), runId: ids.run, version: 1, objective: planOutput.objective,
    steps: planOutput.steps.map((step, index) => ({ id: randomUUID(), goal: step.goal, queryTemplates: step.queries, preferredSourceTypes: step.preferredSourceTypes, completionCriteria: step.completionCriteria, priority: index + 1, status: "COMPLETED" })),
    stopConditions: planOutput.stopConditions
  };
  emit("PLANNING", message("搜索计划已生成。", "Search plan created."), "PLAN_COMPLETED", { queryCount: plan.steps.flatMap((step) => step.queryTemplates).length });
  emit("RETRIEVING", message("正在检索候选来源并抓取正文。", "Retrieving candidate sources and reading their content."), "RUN_RETRIEVING");

  const sources: SourceView[] = [];
  const snapshots: SourceSnapshotView[] = [];
  const documents: ParsedSourceDocument[] = [];
  const excludedSources: ExcludedSourceView[] = [];
  const queries: SearchQueryView[] = [];
  const retrievalAttempts: RetrievalAttemptView[] = [];
  const seenCandidateUrls = new Set<string>();
  const seenFinalUrls = new Set<string>();
  let candidateCount = 0;

  const retrieveRound = async (queryText: string, round: number, step = plan.steps[0]!) => {
    const query: SearchQueryView = { id: randomUUID(), runId: ids.run, stepId: step.id, query: queryText, round, provider: dependencies.searchProvider.constructor.name, language: outputLocale, freshness: null, queryHash: hash(queryText), createdAt: new Date().toISOString() };
    queries.push(query);
    emit("RETRIEVING", round === 1 ? message("已提交搜索查询。", "Search query submitted.") : message("已提交一次定向补搜查询。", "Targeted follow-up query submitted."), "QUERY_STARTED", { query: queryText, round });
    const startedAt = new Date().toISOString();
    const searchResult = await dependencies.searchProvider.search({ query: queryText, sourceScope: step.preferredSourceTypes, language: outputLocale, count: input.maxSources ?? 5, requestId: query.id, ...(input.signal ? { signal: input.signal } : {}) });
    candidateCount += searchResult.candidates.length;
    retrievalAttempts.push({ id: randomUUID(), queryId: query.id, status: "COMPLETED", candidateCount: searchResult.candidates.length, startedAt, completedAt: new Date().toISOString(), errorCode: null });
    emit("RETRIEVING", message(`发现 ${searchResult.candidates.length} 个候选来源。`, `Found ${searchResult.candidates.length} candidate sources.`), "QUERY_COMPLETED", { candidateCount: searchResult.candidates.length, round });

    for (const candidate of searchResult.candidates.slice(0, input.maxSources ?? 5)) {
      let candidateUrl: string;
      try { candidateUrl = canonicalizeUrl(candidate.url); }
      catch { candidateUrl = candidate.url; }
      if (seenCandidateUrls.has(candidateUrl)) {
        excludedSources.push({ id: randomUUID(), runId: ids.run, url: candidate.url, stage: "DISCOVERY", reasonCode: "DUPLICATE_SOURCE", publicSummary: message("该来源与已处理 URL 重复，已跳过。", "This source duplicates a URL already processed and was skipped."), createdAt: new Date().toISOString() });
        continue;
      }
      seenCandidateUrls.add(candidateUrl);
      try {
        const domain = hostname(candidate.url);
        emit("RETRIEVING", message(`正在读取 ${domain}。`, `Reading ${domain}.`), "SOURCE_FETCH_STARTED", { domain, round });
        const fetched = await dependencies.contentFetcher.fetch(candidate, input.signal);
        const finalUrl = canonicalizeUrl(fetched.finalUrl);
        if (seenFinalUrls.has(finalUrl)) {
          excludedSources.push({ id: randomUUID(), runId: ids.run, url: candidate.url, stage: "FETCH", reasonCode: "DUPLICATE_SOURCE", publicSummary: message("该来源重定向到已保存正文，已去重。", "This source redirected to content already saved and was deduplicated."), createdAt: new Date().toISOString() });
          continue;
        }
        seenFinalUrls.add(finalUrl);
        const sourceId = randomUUID();
        const snapshotId = randomUUID();
        const official = isOfficial(candidate);
        sources.push({ id: sourceId, canonicalUrl: finalUrl, title: candidate.title, publisher: domain, domain, sourceType: official ? "OFFICIAL_DOC" : "ARTICLE", publishedAt: candidate.publishedAt ?? null, updatedAtSource: null, accessedAt: fetched.fetchedAt, language: candidate.language ?? "en", isOfficial: official });
        snapshots.push({ id: snapshotId, sourceId, fetchedAt: fetched.fetchedAt, contentHash: hash(fetched.body), contentType: fetched.contentType, versionLabel: null, parseStatus: fetched.truncated ? "PARTIAL" : "PARSED", parserVersion: "html-blocks-v1" });
        documents.push(parseHtmlDocument(snapshotId, fetched.body));
        emit("RETRIEVING", message(`已保存 ${domain} 的正文快照。`, `Saved a content snapshot from ${domain}.`), "SOURCE_FETCHED", { domain, round });
      } catch (error) {
        excludedSources.push({ id: randomUUID(), runId: ids.run, url: candidate.url, stage: "FETCH", reasonCode: error instanceof Error ? error.name : "FETCH_FAILED", publicSummary: message("该来源无法安全读取，已跳过。", "This source could not be read safely and was skipped."), createdAt: new Date().toISOString() });
        emit("RETRIEVING", message("一个候选来源已跳过。", "A candidate source was skipped."), "SOURCE_EXCLUDED", { round });
      }
    }
  };

  const extractKnowledge = async () => {
    const passages = documents
      .flatMap((document) => selectPassages(document, input.question, 5))
      .sort((left, right) => right.score - left.score)
      .slice(0, 24);
    const extraction = (await dependencies.modelGateway.generateStructured({
      operation: "quick-extract", promptVersion: "quick-extract-v2", systemInstruction: `Extract claims only from supplied passages. Preserve exact excerpts and locator IDs. ${outputLanguageInstruction(outputLocale)}`,
      input: JSON.stringify({ question: input.question, passages }), outputSchemaName: "quick_extraction", outputJsonSchema: schemas.extraction,
      parse: (value) => QuickExtractionOutputSchema.parse(value), maxOutputTokens: 4800, ...(input.signal ? { signal: input.signal } : {})
    })).data;
    const sourceBySnapshot = new Map(snapshots.map((snapshot) => [snapshot.id, sources.find((source) => source.id === snapshot.sourceId)!]));
    const evidence: EvidenceView[] = [];
    const claims: ClaimView[] = [];
    const claimEvidence: ClaimEvidenceView[] = [];
    const claimByKey = new Map<string, ClaimView>();
    const evidenceByHash = new Map<string, EvidenceView>();
    const linkKeys = new Set<string>();
    const importanceRank = { BACKGROUND: 0, SUPPORTING: 1, KEY: 2, DECISIVE: 3 } as const;
    for (const candidate of extraction.claims) {
      const validEvidence = candidate.evidence.filter((item) => {
        const document = documents.find((doc) => doc.snapshotId === item.snapshotId);
        return document ? verifyExactAnchor(document, item.blockId, item.exactExcerpt) : false;
      });
      if (validEvidence.length === 0) continue;
      const claimKey = candidate.normalizedStatement.trim().toLowerCase().replace(/\s+/g, " ");
      let claim = claimByKey.get(claimKey);
      if (!claim) {
        claim = { id: randomUUID(), runId: ids.run, statement: candidate.statement, normalizedStatement: candidate.normalizedStatement, claimType: candidate.claimType, importance: candidate.importance, status: "INCLUDED", scope: candidate.scope };
        claimByKey.set(claimKey, claim);
        claims.push(claim);
      } else if (importanceRank[candidate.importance] > importanceRank[claim.importance]) {
        claim.importance = candidate.importance;
      }
      for (const item of validEvidence) {
        const source = sourceBySnapshot.get(item.snapshotId);
        if (!source) continue;
        const evidenceHash = hash(`${item.snapshotId}:${item.blockId}:${item.exactExcerpt}`);
        let evidenceItem = evidenceByHash.get(evidenceHash);
        if (!evidenceItem) {
          evidenceItem = { id: randomUUID(), snapshotId: item.snapshotId, evidenceType: "QUOTE", excerpt: item.exactExcerpt, paraphrase: item.paraphrase, locator: { blockId: item.blockId }, evidenceHash, extractionMethod: "MODEL", extractorVersion: "quick-extract-v1", language: source.language };
          evidenceByHash.set(evidenceHash, evidenceItem);
          evidence.push(evidenceItem);
        }
        const linkKey = `${claim.id}:${evidenceItem.id}:${item.stance}`;
        if (linkKeys.has(linkKey)) continue;
        linkKeys.add(linkKey);
        const freshness = source.publishedAt || source.updatedAtSource ? "CURRENT" as const : "UNKNOWN" as const;
        claimEvidence.push({
          id: randomUUID(), claimId: claim.id, evidenceId: evidenceItem.id, stance: item.stance, relevance: item.relevance,
          authority: source.isOfficial ? "STRONG" : "ADEQUATE", primaryContext: source.isOfficial ? "PRIMARY" : "SECONDARY",
          freshness, independenceGroup: source.domain,
          assessmentNotes: [
            source.isOfficial ? message("第一方或官方来源", "Primary or official source") : message("公开来源", "Public source"),
            item.relevance === "DIRECT" ? message("证据直接支持该 Claim", "Evidence directly supports this claim") : message("证据仅提供部分或上下文支持", "Evidence provides only partial or contextual support"),
            freshness === "UNKNOWN" ? message("来源未提供可验证日期", "The source provides no verifiable date") : message("来源提供了可验证日期", "The source provides a verifiable date")
          ],
          evaluatorVersion: "evidence-assessment-v1", assessedAt: new Date().toISOString()
        });
      }
    }
    return { claims, evidence, claimEvidence };
  };

  const allPlannedQueries = plan.steps.flatMap((step) => step.queryTemplates.map((query) => ({ query, step })));
  const firstPlanned = allPlannedQueries[0]!;
  await retrieveRound(firstPlanned.query, 1, firstPlanned.step);
  if (candidateCount === 0) {
    const fallbackQuery = `${intent.normalizedQuestion} official documentation`;
    await retrieveRound(fallbackQuery, 2);
  }
  if (candidateCount === 0) throw new QuickAgentError("NO_SEARCH_RESULTS", message("搜索没有返回候选来源。", "The search returned no candidate sources."));
  if (documents.length === 0) throw new QuickAgentError("NO_FETCHABLE_SOURCES", message("没有可安全读取的正文来源。", "No source content could be read safely."));

  emit("EXTRACTING", message("正在从正文段落提取 Claim 与 Evidence。", "Extracting claims and evidence from source passages."), "RUN_EXTRACTING");
  let knowledge = await extractKnowledge();
  emit("EXTRACTING", message(`已保留 ${knowledge.evidence.length} 条可定位证据。`, `Retained ${knowledge.evidence.length} locatable evidence items.`), "EXTRACTION_COMPLETED", { claimCount: knowledge.claims.length, evidenceCount: knowledge.evidence.length });
  emit("EVALUATING", message("正在按确定性规则评估来源与证据。", "Evaluating sources and evidence with deterministic rules."), "RUN_EVALUATING");
  let conflicts: ConflictView[] = knowledge.claims.flatMap((claim) => {
    const contradictory = knowledge.claimEvidence.filter((link) => link.claimId === claim.id && link.stance === "CONTRADICTS");
    return contradictory.length ? [{ id: randomUUID(), runId: ids.run, subjectClaimId: claim.id, conflictingClaimId: null, severity: claim.importance === "DECISIVE" ? "MATERIAL" as const : "MINOR" as const, status: "OPEN" as const, summary: message("保存的证据中存在与该结论相矛盾的内容。", "Saved evidence contains content that contradicts this claim."), claimEvidenceIds: contradictory.map((link) => link.id) }] : [];
  });
  let trustSummaries = knowledge.claims.map((claim) => evaluateClaimTrust({ claim, links: knowledge.claimEvidence.filter((link) => link.claimId === claim.id), conflicts, evaluatedAt: new Date().toISOString(), outputLocale }));
  let overallConfidence = calculateOverallConfidence(knowledge.claims, trustSummaries);
  emit("EVALUATING", message("Trust Rules 评估完成。", "Trust Rules assessment completed."), "TRUST_COMPLETED", { overallConfidence });
  emit("GAP_CHECK", message("正在检查关键结论的证据覆盖。", "Checking evidence coverage for key claims."), "RUN_GAP_CHECK");

  const existingQueryHashes = new Set(queries.map((query) => query.queryHash));
  const plannedSupplement = allPlannedQueries.find((item) => !existingQueryHashes.has(hash(item.query)));
  const supplement = plannedSupplement ?? { query: `${intent.normalizedQuestion} official documentation evidence`, step: plan.steps[0]! };
  const needsSupplement = knowledge.claims.length === 0 || overallConfidence === "INSUFFICIENT";
  if (needsSupplement && !existingQueryHashes.has(hash(supplement.query))) {
    emit("GAP_CHECK", message("关键结论仍有证据缺口，将执行一次定向补搜。", "Key claims still have an evidence gap; one targeted follow-up search will run."), "GAP_CHECK_COMPLETED", { needsMoreSearch: true, supplementalRound: 2 });
    const documentCountBefore = documents.length;
    emit("RETRIEVING", message("正在执行唯一一次定向补搜。", "Running the single targeted follow-up search."), "RUN_RETRIEVING", { round: 2 });
    await retrieveRound(supplement.query, 2, supplement.step);
    if (documents.length > documentCountBefore) {
      emit("EXTRACTING", message("正在合并补搜正文并重新抽取证据。", "Merging follow-up source content and extracting evidence again."), "RUN_EXTRACTING", { round: 2 });
      knowledge = await extractKnowledge();
      emit("EXTRACTING", message(`补搜后保留 ${knowledge.evidence.length} 条可定位证据。`, `Retained ${knowledge.evidence.length} locatable evidence items after the follow-up search.`), "EXTRACTION_COMPLETED", { claimCount: knowledge.claims.length, evidenceCount: knowledge.evidence.length, round: 2 });
      emit("EVALUATING", message("正在重新计算证据可信度。", "Recalculating evidence confidence."), "RUN_EVALUATING", { round: 2 });
      conflicts = knowledge.claims.flatMap((claim) => {
        const contradictory = knowledge.claimEvidence.filter((link) => link.claimId === claim.id && link.stance === "CONTRADICTS");
        return contradictory.length ? [{ id: randomUUID(), runId: ids.run, subjectClaimId: claim.id, conflictingClaimId: null, severity: claim.importance === "DECISIVE" ? "MATERIAL" as const : "MINOR" as const, status: "OPEN" as const, summary: message("保存的证据中存在与该结论相矛盾的内容。", "Saved evidence contains content that contradicts this claim."), claimEvidenceIds: contradictory.map((link) => link.id) }] : [];
      });
      trustSummaries = knowledge.claims.map((claim) => evaluateClaimTrust({ claim, links: knowledge.claimEvidence.filter((link) => link.claimId === claim.id), conflicts, evaluatedAt: new Date().toISOString(), outputLocale }));
      overallConfidence = calculateOverallConfidence(knowledge.claims, trustSummaries);
      emit("EVALUATING", message("补搜后的 Trust Rules 评估完成。", "Trust Rules assessment completed after the follow-up search."), "TRUST_COMPLETED", { overallConfidence, round: 2 });
      emit("GAP_CHECK", message("定向补搜已完成，停止继续扩张搜索。", "Targeted follow-up search completed; no further expansion will run."), "RUN_GAP_CHECK", { round: 2 });
    }
  }
  if (knowledge.claims.length === 0) throw new QuickAgentError("NO_VERIFIABLE_EVIDENCE", message("两轮抽取的证据均未通过原文锚点校验。", "Evidence from both extraction rounds failed the exact-source-anchor check."));
  const partialReason = overallConfidence === "INSUFFICIENT" ? message("决定性结论在一次补搜后仍缺少直接可核验证据。", "The decisive claim still lacks directly verifiable evidence after one follow-up search.") : undefined;
  emit("GAP_CHECK", partialReason ?? message("关键结论已获得可核验证据。", "Key claims have obtained verifiable evidence."), "GAP_CHECK_COMPLETED", { needsMoreSearch: false, rounds: queries.length });
  emit("SYNTHESIZING", message("正在整理结构化结果。", "Organizing structured findings."), "RUN_SYNTHESIZING");
  const synthesis = (await dependencies.modelGateway.generateStructured({
    operation: "quick-synthesis", promptVersion: "quick-synthesis-v2", systemInstruction: `Synthesize only from claims and trust summaries. Do not add unsupported facts. ${outputLanguageInstruction(outputLocale)}`,
    input: JSON.stringify({ question: input.question, claims: knowledge.claims, trustSummaries }), outputSchemaName: "quick_synthesis", outputJsonSchema: schemas.synthesis,
    parse: (value) => QuickSynthesisOutputSchema.parse(value), maxOutputTokens: 1600, ...(input.signal ? { signal: input.signal } : {})
  })).data;
  emit("SYNTHESIZING", message("结构化答案已生成。", "Structured answer created."), "SYNTHESIS_COMPLETED");
  emit("MATERIALIZING", message("正在生成可保存的 Search Note。", "Creating a savable Search Note."), "RUN_MATERIALIZING");
  emit("MATERIALIZING", message("Search Note 草稿已生成。", "Search Note draft created."), "NOTE_DRAFTED");
  emit(partialReason ? "PARTIAL" : "COMPLETED", partialReason ? message("搜索已部分完成。", "Search completed with partial results.") : message("搜索已完成。", "Search completed."), partialReason ? "RUN_PARTIAL" : "RUN_COMPLETED");
  const bundle = buildQuickSearchBundle({ ids, question: input.question, requestedMode: input.requestedMode, outputLocale, ...(input.parentRunId !== undefined ? { parentRunId: input.parentRunId } : {}), ...(input.trigger ? { trigger: input.trigger } : {}), now, intent, plan, sources, snapshots, evidence: knowledge.evidence, claims: knowledge.claims, claimEvidence: knowledge.claimEvidence, trustSummaries, conflicts, synthesis, overallConfidence, events, ...(partialReason ? { partialReason } : {}) });
  return { bundle, queries, retrievalAttempts, documents, excludedSources };
}
