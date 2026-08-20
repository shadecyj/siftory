import { quickPythonDictBundle, quickPythonDictPartialBundle } from "@searchos/fixtures";
import { describe, expect, it } from "vitest";
import { localizeReplayBundle, localizeReplayQuestion } from "./replay-presentation";

describe("Replay presentation locale adapter", () => {
  it("uses authored English copy for the known sample while retaining evidence provenance", () => {
    const localized = localizeReplayBundle(quickPythonDictBundle, "en-US");
    const originalParagraph = quickPythonDictBundle.result.answerSections[0]?.nodes.find((node) => node.type === "PARAGRAPH");
    const localizedParagraph = localized.result.answerSections[0]?.nodes.find((node) => node.type === "PARAGRAPH");

    expect(localized).not.toBe(quickPythonDictBundle);
    expect(localized.task.originalQuestion).toBe("How do I delete a dict key in Python?");
    expect(localized.result.title).toBe("Delete a Python dict key");
    expect(localized.claims[0]?.statement).toContain("Use del data[key]");
    expect(localizedParagraph).toMatchObject({ type: "PARAGRAPH", text: "Use del data[key] when the key is known to exist. Use data.pop(key, default) when you also need the removed value or want to safely handle a missing key." });
    expect(originalParagraph).toMatchObject({ type: "PARAGRAPH", text: "已知键存在时，使用 del data[key]。如果希望同时取得被删除的值，或安全处理键不存在的情况，使用 data.pop(key, default)。" });

    // Original source material is provenance, not interface copy. It must stay byte-for-byte unchanged.
    expect(localized.sources[0]?.title).toBe(quickPythonDictBundle.sources[0]?.title);
    expect(localized.sources[0]?.canonicalUrl).toBe(quickPythonDictBundle.sources[0]?.canonicalUrl);
    expect(localized.evidence[0]?.excerpt).toBe(quickPythonDictBundle.evidence[0]?.excerpt);
    expect(localized.evidence[0]?.locator).toEqual(quickPythonDictBundle.evidence[0]?.locator);
    expect(localized.evidence[0]?.paraphrase).toContain("removes the corresponding item");
    expect(localized.claimEvidence[0]?.assessmentNotes).toContain("Official Python language reference");
    expect(localized.savedNote.myNotes).toBe(quickPythonDictBundle.savedNote.myNotes);
    expect(localized.events.at(-1)?.summary).toBe("Search completed");
  });

  it("localizes the canonical header question but preserves arbitrary query text", () => {
    expect(localizeReplayQuestion(quickPythonDictBundle, quickPythonDictBundle.task.originalQuestion, "en-US")).toBe("How do I delete a dict key in Python?");
    expect(localizeReplayQuestion(quickPythonDictBundle, "A custom URL query", "en-US")).toBe("A custom URL query");
    expect(localizeReplayQuestion(quickPythonDictBundle, quickPythonDictBundle.task.originalQuestion, "zh-CN")).toBe(quickPythonDictBundle.task.originalQuestion);
  });

  it("covers fixture partial-state copy and leaves non-fixture bundles untouched", () => {
    const partial = localizeReplayBundle(quickPythonDictPartialBundle, "en-US");
    const nonFixture = { ...quickPythonDictBundle, task: { ...quickPythonDictBundle.task, id: "00000000-0000-7000-8000-000000000099" } };

    expect(partial.run.partialReason).toBe("One supplementary source did not finish verification before the budget ended.");
    expect(partial.result.limitations).toContain("One supplementary source has not finished verification.");
    expect(localizeReplayBundle(quickPythonDictBundle, "zh-CN")).toBe(quickPythonDictBundle);
    expect(localizeReplayBundle(nonFixture, "en-US")).toBe(nonFixture);
  });

  it("does not leave Chinese system-authored demo copy in the English presentation", () => {
    const localized = localizeReplayBundle(quickPythonDictBundle, "en-US");

    // Personal notes are user-owned content, so they intentionally stay in their
    // original language. Everything else in this known demo is system-authored
    // presentation copy and must be ready for an all-English walkthrough.
    const presentationOnly = {
      ...localized,
      savedNote: { ...localized.savedNote, myNotes: "" }
    };

    expect(JSON.stringify(presentationOnly)).not.toMatch(/[一-龥]/);
  });
});
