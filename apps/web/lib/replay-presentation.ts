import type { SearchBundle } from "@searchos/contracts";
import type { Locale } from "./i18n/locale";

/**
 * The static Replay page is a deterministic product demo, rather than a
 * historical user search. Its underlying fixture deliberately stays in one
 * canonical language for contract testing. This display-only adapter gives
 * that one known demo an authored English view without altering the fixture,
 * persisted objects, source records, or evidence quotations.
 */
const quickPythonDictFixtureTaskId = "00000000-0000-7000-8000-000000000002";

const englishTextByChineseText: Readonly<Record<string, string>> = {
  "Python 怎么删除 dict key？": "How do I delete a dict key in Python?",
  "如何在 Python 中删除字典键，并安全处理键不存在的情况？": "How do I remove a Python dictionary key and safely handle a missing key?",
  "用户使用 Python 3，并需要了解键不存在时的行为。": "The user is working with Python 3 and needs to understand the missing-key behavior.",
  "确认 Python 删除字典键的标准方式以及键不存在时的行为。": "Confirm the standard ways to remove a Python dictionary key and what happens when the key is absent.",
  "查阅 Python 官方文档，验证 del 和 pop 的行为。": "Read the official Python documentation to verify the behavior of del and pop.",
  "找到直接说明删除行为的官方证据": "Find official evidence that directly describes deletion behavior.",
  "覆盖键不存在时的差异": "Cover the difference when the key is absent.",
  "两个关键操作均获得官方直接证据": "Both key operations have direct official evidence.",
  "使用 del data[key] 可以直接删除 Python 字典中的键；键不存在时会抛出 KeyError。": "Use del data[key] to remove a key directly from a Python dictionary; it raises KeyError when the key is absent.",
  "使用 data.pop(key, default) 可以删除键并返回其值；提供 default 可安全处理键不存在的情况。": "Use data.pop(key, default) to remove a key and return its value; a default safely handles an absent key.",
  "del d[key] 会从字典删除对应项；键不存在时会抛出 KeyError。": "del d[key] removes the corresponding item from the dictionary and raises KeyError when the key is absent.",
  "dict.pop 会删除键并返回它的值；提供 default 时，键不存在不会抛出 KeyError。": "dict.pop removes the key and returns its value; when a default is provided, an absent key does not raise KeyError.",
  "Python 官方语言参考直接支持该操作，且未发现版本冲突。": "The official Python language reference directly supports this operation, with no version conflict found.",
  "Python 官方标准类型文档直接说明 pop 的删除、返回值与 default 行为。": "The official Python standard-types documentation directly describes pop's removal, return value, and default behavior.",
  "Python 官方语言参考": "Official Python language reference",
  "证据直接描述 del 行为": "The evidence directly describes del behavior.",
  "适用于当前 Python 3 文档": "Applies to the current Python 3 documentation.",
  "Python 官方标准类型文档": "Official Python standard-types documentation",
  "证据直接描述 pop 与 default 行为": "The evidence directly describes pop and default behavior.",
  "删除 Python 字典键": "Delete a Python dict key",
  "直接答案": "Direct answer",
  "已知键存在时，使用 del data[key]。如果希望同时取得被删除的值，或安全处理键不存在的情况，使用 data.pop(key, default)。": "Use del data[key] when the key is known to exist. Use data.pop(key, default) when you also need the removed value or want to safely handle a missing key.",
  "直接删除：del data[key]": "Direct deletion: del data[key]",
  "安全删除并返回值：data.pop(key, None)": "Safe deletion with a return value: data.pop(key, None)",
  "两条关键结论均由 Python 官方文档直接支持。": "Both key conclusions are directly supported by official Python documentation.",
  "证据适用于当前 Python 3 文档。": "The evidence applies to the current Python 3 documentation.",
  "未发现实质冲突。": "No material conflict was found.",
  "该结果针对 Python 内置 dict，不涵盖自定义 Mapping 类型。": "This result applies to Python's built-in dict and does not cover custom Mapping types.",
  "一个补充来源尚未完成验证。": "One supplementary source has not finished verification.",
  "一个补充来源在预算结束前未完成验证。": "One supplementary source did not finish verification before the budget ended.",
  "尚未找到能够直接支持该关键结论的可定位证据。": "No locatable evidence directly supporting this key claim has been found yet.",
  "关键 Claim 尚无直接证据。": "The decisive claim does not yet have direct evidence.",
  "决定性 Claim 尚未获得直接证据，因此不能输出确定性结论。": "The decisive claim has not received direct evidence, so a conclusive answer cannot be given.",
  "删除操作的决定性 Claim 仍需要直接证据。": "The decisive claim about deletion still needs direct evidence.",
  "Python 删除字典键：del 与 pop": "Delete a Python dict key: del and pop",
  "使用 del 直接删除已知存在的键；使用 pop 在删除时返回值，并可通过 default 安全处理缺失键。": "Use del to remove a known existing key directly; use pop to return the removed value and safely handle a missing key with a default.",
  "任务已创建": "Search task created",
  "识别为 Quick 搜索": "Classified as a Quick search",
  "生成官方来源优先的搜索计划": "Created an official-source-first search plan",
  "查找 Python 官方文档": "Found official Python documentation",
  "从两个来源提取证据": "Extracted evidence from two sources",
  "评估 Claim 与 Evidence 的支持关系": "Evaluated support relationships between claims and evidence",
  "关键结论证据覆盖充分": "Key-claim evidence coverage is sufficient",
  "生成结构化答案": "Created a structured answer",
  "生成 Search Note draft": "Created a Search Note draft",
  "搜索完成": "Search completed"
};

function isQuickPythonDictFixture(bundle: SearchBundle): boolean {
  return bundle.task.id === quickPythonDictFixtureTaskId && bundle.result.synthesisVersion === "fixture-synthesis-1";
}

function translateFixtureText(text: string): string {
  return englishTextByChineseText[text] ?? text;
}

/**
 * Returns an authored presentation copy for the static Replay fixture only.
 * All source identity and original evidence fields intentionally retain their
 * source language: source titles, domains, URLs, locators, and excerpts are
 * provenance rather than interface copy.
 */
export function localizeReplayBundle(bundle: SearchBundle, locale: Locale): SearchBundle {
  if (locale !== "en-US" || !isQuickPythonDictFixture(bundle)) return bundle;

  return {
    ...bundle,
    task: {
      ...bundle.task,
      originalQuestion: translateFixtureText(bundle.task.originalQuestion),
      currentQuestion: translateFixtureText(bundle.task.currentQuestion)
    },
    intent: {
      ...bundle.intent,
      normalizedQuestion: translateFixtureText(bundle.intent.normalizedQuestion),
      assumptions: bundle.intent.assumptions.map(translateFixtureText)
    },
    plan: {
      ...bundle.plan,
      objective: translateFixtureText(bundle.plan.objective),
      steps: bundle.plan.steps.map((step) => ({
        ...step,
        goal: translateFixtureText(step.goal),
        completionCriteria: step.completionCriteria.map(translateFixtureText)
      })),
      stopConditions: bundle.plan.stopConditions.map(translateFixtureText)
    },
    evidence: bundle.evidence.map((evidence) => ({
      ...evidence,
      // `excerpt` is the original evidence and must never be translated here.
      paraphrase: translateFixtureText(evidence.paraphrase)
    })),
    claimEvidence: bundle.claimEvidence.map((link) => ({
      ...link,
      assessmentNotes: link.assessmentNotes.map(translateFixtureText)
    })),
    claims: bundle.claims.map((claim) => ({
      ...claim,
      statement: translateFixtureText(claim.statement)
    })),
    trustSummaries: bundle.trustSummaries.map((summary) => ({
      ...summary,
      explanation: translateFixtureText(summary.explanation)
    })),
    conflicts: bundle.conflicts.map((conflict) => ({
      ...conflict,
      summary: translateFixtureText(conflict.summary)
    })),
    run: {
      ...bundle.run,
      partialReason: bundle.run.partialReason === null ? null : translateFixtureText(bundle.run.partialReason)
    },
    result: {
      ...bundle.result,
      title: translateFixtureText(bundle.result.title),
      answerSections: bundle.result.answerSections.map((section) => ({
        ...section,
        heading: translateFixtureText(section.heading),
        nodes: section.nodes.map((node) => {
          if (node.type === "PARAGRAPH") return { ...node, text: translateFixtureText(node.text) };
          if (node.type === "LIST") return { ...node, items: node.items.map((item) => ({ ...item, text: translateFixtureText(item.text) })) };
          return node;
        })
      })),
      confidenceExplanation: bundle.result.confidenceExplanation.map(translateFixtureText),
      limitations: bundle.result.limitations.map(translateFixtureText)
    },
    noteDraft: {
      ...bundle.noteDraft,
      title: translateFixtureText(bundle.noteDraft.title),
      summary: translateFixtureText(bundle.noteDraft.summary),
      claims: bundle.noteDraft.claims.map((claim) => ({ ...claim, statementSnapshot: translateFixtureText(claim.statementSnapshot) }))
    },
    savedNote: {
      ...bundle.savedNote,
      title: translateFixtureText(bundle.savedNote.title),
      summary: translateFixtureText(bundle.savedNote.summary),
      // Personal notes are user-authored context, even in the fixture. Never translate them.
      claims: bundle.savedNote.claims.map((claim) => ({ ...claim, statementSnapshot: translateFixtureText(claim.statementSnapshot) }))
    },
    events: bundle.events.map((event) => ({ ...event, summary: translateFixtureText(event.summary) }))
  };
}

/**
 * The static route may receive its canonical fixture question as a prop.
 * Keep arbitrary URL text untouched, but make that known sample question
 * follow the active interface language with the rest of the demo.
 */
export function localizeReplayQuestion(bundle: SearchBundle, question: string, locale: Locale): string {
  if (locale !== "en-US" || !isQuickPythonDictFixture(bundle)) return question;
  return question === bundle.task.originalQuestion ? translateFixtureText(question) : question;
}
