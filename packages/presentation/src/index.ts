import { SearchBundleSchema, type ClaimEvidenceView, type ClaimTrustSummary, type ClaimView, type ConflictView, type EvidenceView, type IntentAssessment, type NoteCategory, type OutputLocale, type QuickSynthesisOutput, type RunEvent, type SearchBundle, type SearchPlan, type SourceSnapshotView, type SourceView } from "@searchos/contracts";
import type { OverallTrust, RequestedMode, RunTrigger } from "@searchos/domain";

export interface BuildQuickBundleInput {
  readonly ids: { task: string; run: string; owner: string; note: string };
  readonly question: string;
  readonly requestedMode: RequestedMode;
  readonly outputLocale?: OutputLocale;
  readonly parentRunId?: string | null;
  readonly trigger?: RunTrigger;
  readonly now: string;
  readonly intent: IntentAssessment;
  readonly plan: SearchPlan;
  readonly sources: readonly SourceView[];
  readonly snapshots: readonly SourceSnapshotView[];
  readonly evidence: readonly EvidenceView[];
  readonly claims: readonly ClaimView[];
  readonly claimEvidence: readonly ClaimEvidenceView[];
  readonly trustSummaries: readonly ClaimTrustSummary[];
  readonly conflicts: readonly ConflictView[];
  readonly synthesis: QuickSynthesisOutput;
  readonly overallConfidence: OverallTrust;
  readonly events: readonly RunEvent[];
  readonly partialReason?: string;
}

const categoryRules: readonly { category: Exclude<NoteCategory, "INBOX" | "OTHER">; pattern: RegExp }[] = [
  { category: "AI_DATA", pattern: /(?:\b(?:ai|llm|rag|deepseek|openai|langgraph|machine learning|artificial intelligence|neural network|data science)\b|人工智能|大模型|智能体|机器学习|深度学习|神经网络|数据科学)/iu },
  { category: "TECHNOLOGY", pattern: /(?:\b(?:python|javascript|typescript|react|next\.js|node\.js|github|git|api|http|database|sql|docker|kubernetes|software|code|programming)\b|编程|代码|开发|数据库|接口|软件工程|前端|后端|容器)/iu },
  { category: "LEARNING_RESEARCH", pattern: /(?:\b(?:research|paper|literature|study method|course|learning|academic)\b|研究方法|文献|论文|学术|课程|学习计划|综述)/iu },
  { category: "PRODUCT_BUSINESS", pattern: /(?:\b(?:product|business|market|pricing|startup|revenue|customer|strategy)\b|产品|商业|市场|定价|创业|营收|用户增长|竞争分析)/iu },
  { category: "WORK", pattern: /(?:\b(?:work|career|interview|resume|meeting|project management|okr)\b|工作|职业|面试|简历|会议|项目管理|绩效)/iu },
  { category: "LIFE", pattern: /(?:\b(?:travel|food|recipe|health|fitness|home|garden|pet|daily life)\b|旅行|美食|菜谱|健康|健身|家居|宠物|生活)/iu }
];

export function suggestCategory(question: string, claims: readonly Pick<ClaimView, "statement">[]): NoteCategory {
  const searchable = `${question}\n${claims.map((claim) => claim.statement).join("\n")}`;
  return categoryRules.find((rule) => rule.pattern.test(searchable))?.category ?? "INBOX";
}

export function buildQuickSearchBundle(input: BuildQuickBundleInput): SearchBundle {
  const outputLocale = input.outputLocale ?? "zh-CN";
  const english = outputLocale === "en-US";
  const includedClaims = input.claims.filter((claim) => claim.status === "INCLUDED");
  const trustByClaim = new Map(input.trustSummaries.map((summary) => [summary.claimId, summary]));
  const decisiveClaimIds = includedClaims.filter((claim) => claim.importance === "DECISIVE").map((claim) => claim.id);
  const keyClaimIds = includedClaims.filter((claim) => claim.importance === "DECISIVE" || claim.importance === "KEY").map((claim) => claim.id);
  const safeDecisiveIds = decisiveClaimIds.length > 0 ? decisiveClaimIds : [includedClaims[0]!.id];
  const safeKeyIds = keyClaimIds.length > 0 ? keyClaimIds : [includedClaims[0]!.id];
  const sourceIds = [...new Set(input.sources.map((source) => source.id))];
  const isPartial = Boolean(input.partialReason) || input.overallConfidence === "INSUFFICIENT";
  const primaryClaims = includedClaims.filter((claim) => claim.importance === "DECISIVE");
  const leadClaims = primaryClaims.length > 0 ? primaryClaims : includedClaims.filter((claim) => claim.importance === "KEY").slice(0, 1);
  const safeLeadClaims = leadClaims.length > 0 ? leadClaims : [includedClaims[0]!];
  const leadIds = new Set(safeLeadClaims.map((claim) => claim.id));
  const supportingClaims = includedClaims.filter((claim) => !leadIds.has(claim.id));
  const groundedAnswer = english
    ? [
        `Based on ${includedClaims.length} claims that passed the evidence-anchor check in this search, the grounded conclusion is: ${safeLeadClaims.map((claim) => claim.statement).join(" ")}`,
        ...(supportingClaims.length > 0 ? [`In addition, ${supportingClaims.map((claim) => claim.statement).join(" ")}`] : []),
        "This answer covers only information traceable to the evidence snapshots collected in this search. Review the scope, limitations, and sources below for applicable exceptions."
      ].join(" ")
    : [
        `基于本次搜索中 ${includedClaims.length} 个已通过证据锚点校验的结论，综合判断是：${safeLeadClaims.map((claim) => claim.statement).join(" ")}`,
        ...(supportingClaims.length > 0 ? [`进一步看，${supportingClaims.map((claim) => claim.statement).join(" ")}`] : []),
        "回答仅覆盖本次检索中可追溯到证据快照的内容，具体适用范围与例外请结合下方边界和来源核对。"
      ].join(" ");
  const noteClaims = includedClaims.map((claim, index) => ({
    claimId: claim.id, statementSnapshot: claim.statement, trustLevelSnapshot: trustByClaim.get(claim.id)?.level ?? "INSUFFICIENT",
    displayOrder: index, isKey: safeKeyIds.includes(claim.id)
  }));
  const result = {
    runId: input.ids.run, status: isPartial ? "PARTIAL" as const : "COMPLETE" as const, title: input.synthesis.title,
    answerSections: [{
      id: "answer", heading: english ? "Direct answer" : "直接回答", nodes: [
        { type: "PARAGRAPH" as const, text: groundedAnswer, claimIds: safeKeyIds },
        ...(input.synthesis.bullets.length > 0 ? [{ type: "LIST" as const, items: input.synthesis.bullets.map((bullet) => ({
          text: bullet.text, claimIds: bullet.claimIndexes.map((index) => includedClaims[index]?.id).filter((id): id is string => Boolean(id))
        })).filter((bullet) => bullet.claimIds.length > 0) }] : [])
      ]
    }],
    decisiveClaimIds: safeDecisiveIds, keyClaimIds: safeKeyIds, sourceIds,
    overallConfidence: input.overallConfidence,
    confidenceReasonCodes: [...new Set(input.trustSummaries.flatMap((summary) => summary.reasonCodes))].slice(0, 8),
    confidenceExplanation: [...new Set(input.trustSummaries.map((summary) => summary.explanation))],
    limitations: [...input.synthesis.limitations, ...(input.partialReason ? [input.partialReason] : [])], synthesisVersion: "quick-synthesis-v1"
  };
  const noteDraft = {
    id: input.ids.note, ownerId: input.ids.owner, taskId: input.ids.task, sourceRunId: input.ids.run,
    title: input.synthesis.title, summary: groundedAnswer, outputLocale, mode: "QUICK" as const,
    overallConfidence: input.overallConfidence, claims: noteClaims, createdAt: input.now
  };
  return SearchBundleSchema.parse({
    task: { id: input.ids.task, ownerId: input.ids.owner, originalQuestion: input.question, currentQuestion: input.question, outputLocale, latestRunId: input.ids.run, createdAt: input.now, updatedAt: input.now },
    run: {
      id: input.ids.run, taskId: input.ids.task, parentRunId: input.parentRunId ?? null, trigger: input.trigger ?? "INITIAL", requestedMode: input.requestedMode, outputLocale,
      selectedMode: "QUICK", modeConfidence: input.intent.modeConfidence, state: isPartial ? "PARTIAL" : "COMPLETED",
      currentStage: isPartial ? "PARTIAL" : "COMPLETED", stopReason: isPartial ? "RETRIEVAL_BLOCKED" : "ANSWER_SUFFICIENT",
      partialReason: input.partialReason ?? null, createdAt: input.now, updatedAt: input.now, startedAt: input.now,
      completedAt: isPartial ? null : input.now, cancelledAt: null
    },
    intent: input.intent, plan: input.plan, sources: input.sources, snapshots: input.snapshots, evidence: input.evidence,
    claims: includedClaims, claimEvidence: input.claimEvidence, trustSummaries: input.trustSummaries,
    conflicts: input.conflicts, result, noteDraft,
    savedNote: { ...noteDraft, isSaved: false, isFavorite: false, category: "INBOX", myNotes: "", updatedAt: input.now, searchDate: input.now },
    events: input.events
  });
}
