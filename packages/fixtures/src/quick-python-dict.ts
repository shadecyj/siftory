import { SearchBundleSchema, type SearchBundle } from "@searchos/contracts";

const ids = {
  owner: "00000000-0000-7000-8000-000000000001",
  task: "00000000-0000-7000-8000-000000000002",
  run: "00000000-0000-7000-8000-000000000003",
  plan: "00000000-0000-7000-8000-000000000004",
  step: "00000000-0000-7000-8000-000000000005",
  sourceDel: "00000000-0000-7000-8000-000000000006",
  sourcePop: "00000000-0000-7000-8000-000000000007",
  snapshotDel: "00000000-0000-7000-8000-000000000008",
  snapshotPop: "00000000-0000-7000-8000-000000000009",
  evidenceDel: "00000000-0000-7000-8000-000000000010",
  evidencePop: "00000000-0000-7000-8000-000000000011",
  claimDel: "00000000-0000-7000-8000-000000000012",
  claimPop: "00000000-0000-7000-8000-000000000013",
  linkDel: "00000000-0000-7000-8000-000000000014",
  linkPop: "00000000-0000-7000-8000-000000000015",
  note: "00000000-0000-7000-8000-000000000016"
} as const;

const baseTime = "2026-08-12T08:00:00.000Z";
const completedTime = "2026-08-12T08:00:08.000Z";

const rawBundle = {
  task: {
    id: ids.task,
    ownerId: ids.owner,
    originalQuestion: "Python 怎么删除 dict key？",
    currentQuestion: "Python 怎么删除 dict key？",
    latestRunId: ids.run,
    createdAt: baseTime,
    updatedAt: completedTime
  },
  run: {
    id: ids.run,
    taskId: ids.task,
    parentRunId: null,
    trigger: "INITIAL",
    requestedMode: "AUTO",
    selectedMode: "QUICK",
    modeConfidence: 0.98,
    state: "COMPLETED",
    currentStage: "COMPLETED",
    stopReason: "ANSWER_SUFFICIENT",
    partialReason: null,
    createdAt: baseTime,
    updatedAt: completedTime,
    startedAt: baseTime,
    completedAt: completedTime,
    cancelledAt: null
  },
  intent: {
    runId: ids.run,
    normalizedQuestion: "如何在 Python 中删除字典键，并安全处理键不存在的情况？",
    selectedMode: "QUICK",
    modeConfidence: 0.98,
    entities: ["Python", "dict", "key"],
    constraints: { language: "Python 3" },
    freshnessRequirement: "VERSIONED",
    ambiguityNotes: [],
    assumptions: ["用户使用 Python 3，并需要了解键不存在时的行为。"],
    classifierVersion: "fixture-intent-1"
  },
  plan: {
    id: ids.plan,
    runId: ids.run,
    version: 1,
    objective: "确认 Python 删除字典键的标准方式以及键不存在时的行为。",
    steps: [
      {
        id: ids.step,
        goal: "查阅 Python 官方文档，验证 del 和 pop 的行为。",
        queryTemplates: ["site:docs.python.org dict del pop key"],
        preferredSourceTypes: ["OFFICIAL_DOC"],
        completionCriteria: ["找到直接说明删除行为的官方证据", "覆盖键不存在时的差异"],
        priority: 1,
        status: "COMPLETED"
      }
    ],
    stopConditions: ["两个关键操作均获得官方直接证据"]
  },
  sources: [
    {
      id: ids.sourceDel,
      canonicalUrl: "https://docs.python.org/3/library/stdtypes.html#mapping-types-dict",
      title: "Mapping Types — dict deletion",
      publisher: "Python Software Foundation",
      domain: "docs.python.org",
      sourceType: "OFFICIAL_DOC",
      publishedAt: null,
      updatedAtSource: null,
      accessedAt: baseTime,
      language: "en",
      isOfficial: true
    },
    {
      id: ids.sourcePop,
      canonicalUrl: "https://docs.python.org/3/library/stdtypes.html#dict.pop",
      title: "Mapping Types — dict.pop",
      publisher: "Python Software Foundation",
      domain: "docs.python.org",
      sourceType: "OFFICIAL_DOC",
      publishedAt: null,
      updatedAtSource: null,
      accessedAt: baseTime,
      language: "en",
      isOfficial: true
    }
  ],
  snapshots: [
    {
      id: ids.snapshotDel,
      sourceId: ids.sourceDel,
      fetchedAt: baseTime,
      contentHash: "sha256-del-fixture",
      contentType: "text/html",
      versionLabel: "Python 3.14",
      parseStatus: "PARSED",
      parserVersion: "fixture-parser-1"
    },
    {
      id: ids.snapshotPop,
      sourceId: ids.sourcePop,
      fetchedAt: baseTime,
      contentHash: "sha256-pop-fixture",
      contentType: "text/html",
      versionLabel: "Python 3.14",
      parseStatus: "PARSED",
      parserVersion: "fixture-parser-1"
    }
  ],
  evidence: [
    {
      id: ids.evidenceDel,
      snapshotId: ids.snapshotDel,
      evidenceType: "QUOTE",
      excerpt: "Remove d[key] from d. Raises a KeyError if key is not in the map.",
      paraphrase: "del d[key] 会从字典删除对应项；键不存在时会抛出 KeyError。",
      locator: { heading: "Mapping Types — dict / del d[key]", paragraph: 1 },
      evidenceHash: "evidence-del-fixture",
      extractionMethod: "PARSER",
      extractorVersion: "fixture-extractor-1",
      language: "en"
    },
    {
      id: ids.evidencePop,
      snapshotId: ids.snapshotPop,
      evidenceType: "QUOTE",
      excerpt: "If key is in the dictionary, remove it and return its value, else return default.",
      paraphrase: "dict.pop 会删除键并返回它的值；提供 default 时，键不存在不会抛出 KeyError。",
      locator: { heading: "dict.pop(key[, default])", paragraph: 1 },
      evidenceHash: "evidence-pop-fixture",
      extractionMethod: "PARSER",
      extractorVersion: "fixture-extractor-1",
      language: "en"
    }
  ],
  claims: [
    {
      id: ids.claimDel,
      runId: ids.run,
      statement: "使用 del data[key] 可以直接删除 Python 字典中的键；键不存在时会抛出 KeyError。",
      normalizedStatement: "python dict del removes key and raises keyerror when missing",
      claimType: "PROCEDURE",
      importance: "DECISIVE",
      status: "INCLUDED",
      scope: { runtime: "Python 3" }
    },
    {
      id: ids.claimPop,
      runId: ids.run,
      statement: "使用 data.pop(key, default) 可以删除键并返回其值；提供 default 可安全处理键不存在的情况。",
      normalizedStatement: "python dict pop removes key returns value default handles missing key",
      claimType: "PROCEDURE",
      importance: "KEY",
      status: "INCLUDED",
      scope: { runtime: "Python 3" }
    }
  ],
  claimEvidence: [
    {
      id: ids.linkDel,
      claimId: ids.claimDel,
      evidenceId: ids.evidenceDel,
      stance: "SUPPORTS",
      relevance: "DIRECT",
      authority: "STRONG",
      primaryContext: "PRIMARY",
      freshness: "CURRENT",
      independenceGroup: "python-official-reference",
      assessmentNotes: ["Python 官方语言参考", "证据直接描述 del 行为", "适用于当前 Python 3 文档"],
      evaluatorVersion: "trust-rules-1",
      assessedAt: completedTime
    },
    {
      id: ids.linkPop,
      claimId: ids.claimPop,
      evidenceId: ids.evidencePop,
      stance: "SUPPORTS",
      relevance: "DIRECT",
      authority: "STRONG",
      primaryContext: "PRIMARY",
      freshness: "CURRENT",
      independenceGroup: "python-official-stdlib",
      assessmentNotes: ["Python 官方标准类型文档", "证据直接描述 pop 与 default 行为"],
      evaluatorVersion: "trust-rules-1",
      assessedAt: completedTime
    }
  ],
  trustSummaries: [
    {
      claimId: ids.claimDel,
      level: "HIGH",
      supportingEvidenceCount: 1,
      contradictingEvidenceCount: 0,
      independentSupportCount: 1,
      primarySourceCount: 1,
      reasonCodes: ["DIRECT_EVIDENCE", "PRIMARY_SOURCE", "CURRENT_VERSION", "NO_MATERIAL_CONFLICT"],
      explanation: "Python 官方语言参考直接支持该操作，且未发现版本冲突。",
      unresolvedMaterialConflict: false,
      rulesetVersion: "trust-rules-1",
      evaluatedAt: completedTime
    },
    {
      claimId: ids.claimPop,
      level: "HIGH",
      supportingEvidenceCount: 1,
      contradictingEvidenceCount: 0,
      independentSupportCount: 1,
      primarySourceCount: 1,
      reasonCodes: ["DIRECT_EVIDENCE", "PRIMARY_SOURCE", "CURRENT_VERSION", "NO_MATERIAL_CONFLICT"],
      explanation: "Python 官方标准类型文档直接说明 pop 的删除、返回值与 default 行为。",
      unresolvedMaterialConflict: false,
      rulesetVersion: "trust-rules-1",
      evaluatedAt: completedTime
    }
  ],
  conflicts: [],
  result: {
    runId: ids.run,
    status: "COMPLETE",
    title: "删除 Python 字典键",
    answerSections: [
      {
        id: "answer",
        heading: "直接答案",
        nodes: [
          {
            type: "PARAGRAPH",
            text: "已知键存在时，使用 del data[key]。如果希望同时取得被删除的值，或安全处理键不存在的情况，使用 data.pop(key, default)。",
            claimIds: [ids.claimDel, ids.claimPop]
          },
          {
            type: "LIST",
            items: [
              { text: "直接删除：del data[key]", claimIds: [ids.claimDel] },
              { text: "安全删除并返回值：data.pop(key, None)", claimIds: [ids.claimPop] }
            ]
          }
        ]
      }
    ],
    decisiveClaimIds: [ids.claimDel],
    keyClaimIds: [ids.claimDel, ids.claimPop],
    sourceIds: [ids.sourceDel, ids.sourcePop],
    overallConfidence: "HIGH",
    confidenceReasonCodes: ["OFFICIAL_DOCUMENTATION", "DIRECT_EVIDENCE", "CURRENT_VERSION"],
    confidenceExplanation: ["两条关键结论均由 Python 官方文档直接支持。", "证据适用于当前 Python 3 文档。", "未发现实质冲突。"],
    limitations: ["该结果针对 Python 内置 dict，不涵盖自定义 Mapping 类型。"],
    synthesisVersion: "fixture-synthesis-1"
  },
  noteDraft: {
    id: ids.note,
    ownerId: ids.owner,
    taskId: ids.task,
    sourceRunId: ids.run,
    title: "Python 删除字典键：del 与 pop",
    summary: "使用 del 直接删除已知存在的键；使用 pop 在删除时返回值，并可通过 default 安全处理缺失键。",
    mode: "QUICK",
    overallConfidence: "HIGH",
    claims: [
      { claimId: ids.claimDel, statementSnapshot: "使用 del data[key] 可以直接删除 Python 字典中的键；键不存在时会抛出 KeyError。", trustLevelSnapshot: "HIGH", displayOrder: 0, isKey: true },
      { claimId: ids.claimPop, statementSnapshot: "使用 data.pop(key, default) 可以删除键并返回其值；提供 default 可安全处理键不存在的情况。", trustLevelSnapshot: "HIGH", displayOrder: 1, isKey: true }
    ],
    createdAt: completedTime
  },
  savedNote: {
    id: ids.note,
    ownerId: ids.owner,
    taskId: ids.task,
    sourceRunId: ids.run,
    title: "Python 删除字典键：del 与 pop",
    summary: "使用 del 直接删除已知存在的键；使用 pop 在删除时返回值，并可通过 default 安全处理缺失键。",
    mode: "QUICK",
    overallConfidence: "HIGH",
    claims: [
      { claimId: ids.claimDel, statementSnapshot: "使用 del data[key] 可以直接删除 Python 字典中的键；键不存在时会抛出 KeyError。", trustLevelSnapshot: "HIGH", displayOrder: 0, isKey: true },
      { claimId: ids.claimPop, statementSnapshot: "使用 data.pop(key, default) 可以删除键并返回其值；提供 default 可安全处理键不存在的情况。", trustLevelSnapshot: "HIGH", displayOrder: 1, isKey: true }
    ],
    createdAt: completedTime,
    isSaved: true,
    isFavorite: false,
    category: "TECHNOLOGY",
    myNotes: "优先使用 pop(key, None) 处理不确定存在的键。",
    updatedAt: completedTime,
    searchDate: baseTime
  },
  events: [
    ["CREATED", "任务已创建"],
    ["UNDERSTANDING", "识别为 Quick 搜索"],
    ["PLANNING", "生成官方来源优先的搜索计划"],
    ["RETRIEVING", "查找 Python 官方文档"],
    ["EXTRACTING", "从两个来源提取证据"],
    ["EVALUATING", "评估 Claim 与 Evidence 的支持关系"],
    ["GAP_CHECK", "关键结论证据覆盖充分"],
    ["SYNTHESIZING", "生成结构化答案"],
    ["MATERIALIZING", "生成 Search Note draft"],
    ["COMPLETED", "搜索完成"]
  ].map(([toState, summary], index) => ({
    id: `10000000-0000-7000-8000-${String(index + 1).padStart(12, "0")}`,
    runId: ids.run,
    sequence: index + 1,
    eventType: `RUN_${toState}`,
    fromState: index === 0 ? null : (["CREATED", "UNDERSTANDING", "PLANNING", "RETRIEVING", "EXTRACTING", "EVALUATING", "GAP_CHECK", "SYNTHESIZING", "MATERIALIZING"] as const)[index - 1]!,
    toState,
    summary,
    createdAt: `2026-08-12T08:00:${String(index).padStart(2, "0")}.000Z`
  }))
};

export const quickPythonDictBundle: SearchBundle = SearchBundleSchema.parse(rawBundle);
export const quickPythonDictIds = ids;

const partialRaw: unknown = {
  ...quickPythonDictBundle,
  run: {
    ...quickPythonDictBundle.run,
    state: "PARTIAL",
    currentStage: "PARTIAL",
    stopReason: "BUDGET_EXHAUSTED",
    partialReason: "一个补充来源在预算结束前未完成验证。",
    completedAt: null
  },
  result: {
    ...quickPythonDictBundle.result,
    status: "PARTIAL",
    limitations: [...quickPythonDictBundle.result.limitations, "一个补充来源尚未完成验证。"]
  }
};

export const quickPythonDictPartialBundle: SearchBundle = SearchBundleSchema.parse(partialRaw);

const insufficientEvidence = quickPythonDictBundle.evidence.filter((item) => item.id !== ids.evidenceDel);
const insufficientLinks = quickPythonDictBundle.claimEvidence.filter((item) => item.claimId !== ids.claimDel);
const insufficientTrust = quickPythonDictBundle.trustSummaries.map((summary) =>
  summary.claimId === ids.claimDel
    ? {
        ...summary,
        level: "INSUFFICIENT" as const,
        supportingEvidenceCount: 0,
        independentSupportCount: 0,
        primarySourceCount: 0,
        reasonCodes: ["NO_DIRECT_EVIDENCE"],
        explanation: "尚未找到能够直接支持该关键结论的可定位证据。"
      }
    : summary
);
const insufficientClaims = quickPythonDictBundle.savedNote.claims.map((claim) =>
  claim.claimId === ids.claimDel ? { ...claim, trustLevelSnapshot: "INSUFFICIENT" as const } : claim
);
const insufficientRaw: unknown = {
  ...quickPythonDictBundle,
  run: {
    ...quickPythonDictBundle.run,
    state: "PARTIAL",
    currentStage: "PARTIAL",
    stopReason: "RETRIEVAL_BLOCKED",
    partialReason: "关键 Claim 尚无直接证据。",
    completedAt: null
  },
  evidence: insufficientEvidence,
  claimEvidence: insufficientLinks,
  trustSummaries: insufficientTrust,
  result: {
    ...quickPythonDictBundle.result,
    status: "PARTIAL",
    sourceIds: [ids.sourcePop],
    overallConfidence: "INSUFFICIENT",
    confidenceReasonCodes: ["DECISIVE_CLAIM_UNSUPPORTED"],
    confidenceExplanation: ["决定性 Claim 尚未获得直接证据，因此不能输出确定性结论。"],
    limitations: ["删除操作的决定性 Claim 仍需要直接证据。"]
  },
  noteDraft: {
    ...quickPythonDictBundle.noteDraft,
    overallConfidence: "INSUFFICIENT",
    claims: insufficientClaims
  },
  savedNote: {
    ...quickPythonDictBundle.savedNote,
    overallConfidence: "INSUFFICIENT",
    claims: insufficientClaims
  }
};

export const quickPythonDictInsufficientBundle: SearchBundle = SearchBundleSchema.parse(insufficientRaw);
