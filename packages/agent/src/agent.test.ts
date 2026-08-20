import { ReplayModelGateway } from "@searchos/model-gateways";
import { ReplaySearchProvider } from "@searchos/retrieval";
import type { ModelRequest, SearchProvider, SearchProviderInput } from "@searchos/domain";
import { describe, expect, it } from "vitest";
import { runQuickSearch } from "./index";

const html = "<title>Python dict docs</title><h2>dict.pop</h2><p>If key is in the dictionary, remove it and return its value, else return default.</p>";

function dependencies() {
  const modelGateway = new ReplayModelGateway({
    "quick-intent": { normalizedQuestion: "如何删除 Python 字典键？", selectedMode: "QUICK", modeConfidence: 0.99, entities: ["Python", "dict"], constraints: {}, freshnessRequirement: "VERSIONED", ambiguityNotes: [], assumptions: [] },
    "quick-plan": { objective: "确认 Python 字典删除方式。", steps: [{ goal: "查询官方文档", queries: ["site:docs.python.org dict pop"], preferredSourceTypes: ["OFFICIAL_DOC"], completionCriteria: ["找到直接证据"] }], stopConditions: ["关键结论有直接证据"] },
    "quick-extract": (request: ModelRequest<unknown>) => {
      const input = JSON.parse(request.input) as { passages: Array<{ snapshotId: string; blockId: string; text: string }> };
      const passage = input.passages.find((item) => item.text.startsWith("If key"))!;
      return { claims: [{ statement: "data.pop(key, default) 会删除键并返回其值。", normalizedStatement: "dict pop removes key", claimType: "PROCEDURE", importance: "DECISIVE", scope: { runtime: "Python 3" }, evidence: [{ snapshotId: passage.snapshotId, blockId: passage.blockId, exactExcerpt: passage.text, paraphrase: "pop 删除键并返回值。", stance: "SUPPORTS", relevance: "DIRECT" }] }] };
    },
    "quick-synthesis": { title: "删除 Python 字典键", summary: "使用 pop 删除并返回值。", answer: "使用 data.pop(key, default)。", bullets: [{ text: "提供 default 可处理缺失键。", claimIndexes: [0] }], limitations: [] }
  });
  return {
    modelGateway,
    searchProvider: new ReplaySearchProvider([{ url: "https://docs.python.org/3/library/stdtypes.html", title: "Python docs", snippet: "dict pop", rank: 1, provider: "replay", language: "en" }]),
    contentFetcher: { fetch: async () => ({ requestedUrl: "https://docs.python.org/3/library/stdtypes.html", finalUrl: "https://docs.python.org/3/library/stdtypes.html", statusCode: 200, contentType: "text/html", body: html, fetchedAt: "2026-08-12T08:00:00.000Z", redirectChain: [], truncated: false }) }
  };
}

function englishDependencies() {
  const modelGateway = new ReplayModelGateway({
    "quick-intent": {
      normalizedQuestion: "How do I delete a key from a Python dict?",
      selectedMode: "QUICK",
      modeConfidence: 0.99,
      entities: ["Python", "dict", "key"],
      constraints: { runtime: "Python 3" },
      freshnessRequirement: "VERSIONED",
      ambiguityNotes: [],
      assumptions: ["The question concerns Python 3's built-in dict."]
    },
    "quick-plan": {
      objective: "Verify the standard dict key deletion operation.",
      steps: [{
        goal: "Read the official Python documentation",
        queries: ["site:docs.python.org dict pop key"],
        preferredSourceTypes: ["OFFICIAL_DOC"],
        completionCriteria: ["Find direct official evidence"]
      }],
      stopConditions: ["The key conclusion has direct evidence"]
    },
    "quick-extract": (request: ModelRequest<unknown>) => {
      const input = JSON.parse(request.input) as { passages: Array<{ snapshotId: string; blockId: string; text: string }> };
      const passage = input.passages.find((item) => item.text.startsWith("If key"))!;
      return {
        claims: [{
          statement: "data.pop(key, default) removes the key and returns its value.",
          normalizedStatement: "dict pop removes key",
          claimType: "PROCEDURE",
          importance: "DECISIVE",
          scope: { runtime: "Python 3" },
          evidence: [{
            snapshotId: passage.snapshotId,
            blockId: passage.blockId,
            exactExcerpt: passage.text,
            paraphrase: "pop removes the key and returns its value.",
            stance: "SUPPORTS",
            relevance: "DIRECT"
          }]
        }]
      };
    },
    "quick-synthesis": {
      title: "Delete a Python dict key",
      summary: "Use pop to remove a key and return its value.",
      answer: "Use data.pop(key, default).",
      bullets: [{ text: "A default safely handles a missing key.", claimIndexes: [0] }],
      limitations: ["This result applies to Python 3's built-in dict."]
    }
  });

  return { ...dependencies(), modelGateway };
}

describe("Quick Agent", () => {
  it("runs an offline evidence-first vertical loop", async () => {
    const seen: string[] = [];
    const result = await runQuickSearch({ question: "Python 怎么删除 dict key？", requestedMode: "AUTO", onEvent: (event) => seen.push(event.eventType) }, dependencies());
    expect(result.bundle.run.state).toBe("COMPLETED");
    expect(result.bundle.result.overallConfidence).toBe("HIGH");
    expect(result.bundle.evidence[0]?.locator.blockId).toBeTruthy();
    expect(result.bundle.claimEvidence[0]?.freshness).toBe("UNKNOWN");
    expect(result.bundle.trustSummaries[0]?.reasonCodes).toContain("FRESHNESS_UNKNOWN");
    expect(seen).toContain("SOURCE_FETCHED");
    expect(seen.at(-1)).toBe("RUN_COMPLETED");
  });

  it("carries the selected output locale through retrieval and the saved bundle", async () => {
    const deps = englishDependencies();
    let requestedLanguage: string | undefined;
    const searchProvider: SearchProvider = {
      async search(input) {
        requestedLanguage = input.language;
        return {
          candidates: [{
            url: "https://docs.python.org/3/library/stdtypes.html",
            title: "Python docs",
            snippet: "dict pop",
            rank: 1,
            provider: "test",
            language: "en"
          }],
          provider: "test",
          requestId: input.requestId,
          durationMs: 1,
          moreResultsAvailable: false
        };
      }
    };
    const result = await runQuickSearch({
      question: "How do I delete a dict key in Python?",
      requestedMode: "QUICK",
      outputLocale: "en-US"
    }, { ...deps, searchProvider });
    expect(requestedLanguage).toBe("en-US");
    expect(result.bundle.task.outputLocale).toBe("en-US");
    expect(result.bundle.run.outputLocale).toBe("en-US");
    expect(result.bundle.savedNote.outputLocale).toBe("en-US");
    expect(result.bundle.result.answerSections[0]?.heading).toBe("Direct answer");
    expect(result.bundle.claims[0]?.statement).toContain("removes the key");
    expect(result.bundle.claimEvidence[0]?.assessmentNotes).toEqual(expect.arrayContaining([
      "Primary or official source",
      "Evidence directly supports this claim",
      "The source provides no verifiable date"
    ]));
    expect(result.bundle.trustSummaries[0]?.explanation).toContain("authoritative primary source");
    expect(result.bundle.events.map((event) => event.summary)).toEqual(expect.arrayContaining([
      "Search run created.",
      "Search completed."
    ]));
    expect(result.bundle.evidence[0]?.excerpt).toBe("If key is in the dictionary, remove it and return its value, else return default.");
    expect(JSON.stringify(result.bundle)).not.toMatch(/[\u4E00-\u9FFF]/u);
  });

  it("keeps a persisted partial reason in the selected output locale", async () => {
    const deps = englishDependencies();
    const cassettes = (deps.modelGateway as unknown as { cassettes: Record<string, unknown> }).cassettes;
    const incompleteGateway = new ReplayModelGateway({
      ...cassettes,
      "quick-extract": (request: ModelRequest<unknown>) => {
        const input = JSON.parse(request.input) as { passages: Array<{ snapshotId: string; blockId: string; text: string }> };
        const passage = input.passages.find((item) => item.text.startsWith("If key"))!;
        return {
          claims: [{
            statement: "data.pop(key, default) removes the key and returns its value.",
            normalizedStatement: "dict pop removes key",
            claimType: "PROCEDURE",
            importance: "DECISIVE",
            scope: { runtime: "Python 3" },
            evidence: [{
              snapshotId: passage.snapshotId,
              blockId: passage.blockId,
              exactExcerpt: passage.text,
              paraphrase: "pop removes the key and returns its value.",
              stance: "SUPPORTS",
              relevance: "PARTIAL"
            }]
          }]
        };
      }
    });

    const result = await runQuickSearch({
      question: "How do I delete a dict key in Python?",
      requestedMode: "QUICK",
      outputLocale: "en-US"
    }, { ...deps, modelGateway: incompleteGateway });

    expect(result.bundle.run.state).toBe("PARTIAL");
    expect(result.bundle.run.partialReason).toContain("directly verifiable evidence");
    expect(result.bundle.result.limitations).toContain(result.bundle.run.partialReason);
    expect(result.bundle.events.at(-1)?.summary).toBe("Search completed with partial results.");
  });

  it("keeps excluded-source records in the selected output locale", async () => {
    const deps = englishDependencies();
    const searchProvider: SearchProvider = {
      async search(input) {
        const candidate = {
          url: "https://docs.python.org/3/library/stdtypes.html",
          title: "Python docs",
          snippet: "dict pop",
          rank: 1,
          provider: "test",
          language: "en"
        };
        return {
          candidates: [candidate, { ...candidate, rank: 2 }],
          provider: "test",
          requestId: input.requestId,
          durationMs: 1,
          moreResultsAvailable: false
        };
      }
    };

    const result = await runQuickSearch({
      question: "How do I delete a dict key in Python?",
      requestedMode: "QUICK",
      outputLocale: "en-US"
    }, { ...deps, searchProvider });

    expect(result.excludedSources[0]?.publicSummary).toBe("This source duplicates a URL already processed and was skipped.");
  });

  it("rejects a topic-only query as too broad before retrieval", async () => {
    await expect(runQuickSearch({ question: "人工智能", requestedMode: "AUTO" }, dependencies())).rejects.toMatchObject({ code: "QUERY_TOO_BROAD" });
  });

  it("does not silently downgrade a Compare intent to Quick", async () => {
    const deps = dependencies();
    const gateway = new ReplayModelGateway({
      ...(deps.modelGateway as unknown as { cassettes: Record<string, unknown> }).cassettes,
      "quick-intent": { normalizedQuestion: "LangGraph 和 CrewAI 怎么选？", selectedMode: "COMPARE", modeConfidence: 0.98, entities: ["LangGraph", "CrewAI"], constraints: {}, freshnessRequirement: "RECENT", ambiguityNotes: [], assumptions: [] }
    });
    await expect(runQuickSearch({ question: "LangGraph 和 CrewAI 怎么选？", requestedMode: "AUTO" }, { ...deps, modelGateway: gateway })).rejects.toMatchObject({ code: "MODE_NOT_AVAILABLE" });
  });

  it("does not accept a fabricated excerpt", async () => {
    const deps = dependencies();
    const badGateway = new ReplayModelGateway({
      ...(deps.modelGateway as unknown as { cassettes: Record<string, unknown> }).cassettes,
      "quick-extract": { claims: [{ statement: "Invented", normalizedStatement: "invented", claimType: "FACT", importance: "DECISIVE", scope: {}, evidence: [{ snapshotId: crypto.randomUUID(), blockId: "missing", exactExcerpt: "Invented", paraphrase: "Invented", stance: "SUPPORTS", relevance: "DIRECT" }] }] }
    });
    await expect(runQuickSearch({ question: "Python 怎么删除 dict key？", requestedMode: "AUTO" }, { ...deps, modelGateway: badGateway })).rejects.toMatchObject({ code: "NO_VERIFIABLE_EVIDENCE" });
  });

  it("isolates a failed source, canonicalizes duplicates, and keeps the usable source", async () => {
    const deps = dependencies();
    const fetched: string[] = [];
    const searchProvider: SearchProvider = {
      async search() {
        return { candidates: [
          { url: "https://broken.example/doc", title: "broken", snippet: "", rank: 1, provider: "test" },
          { url: "https://docs.python.org/3/library/stdtypes.html?utm_source=test", title: "docs", snippet: "", rank: 2, provider: "test" },
          { url: "https://docs.python.org/3/library/stdtypes.html", title: "duplicate", snippet: "", rank: 3, provider: "test" }
        ], provider: "test", requestId: crypto.randomUUID(), durationMs: 1, moreResultsAvailable: false };
      }
    };
    const contentFetcher = {
      fetch: async (source: { url: string }) => {
        fetched.push(source.url);
        if (source.url.includes("broken")) throw new Error("FETCH_FAILED");
        return { requestedUrl: source.url, finalUrl: source.url, statusCode: 200, contentType: "text/html", body: html, fetchedAt: "2026-08-12T08:00:00.000Z", redirectChain: [], truncated: false };
      }
    };
    const result = await runQuickSearch({ question: "Python dict pop", requestedMode: "QUICK" }, { ...deps, searchProvider, contentFetcher });
    expect(result.bundle.sources).toHaveLength(1);
    expect(result.excludedSources.map((item) => item.reasonCode)).toEqual(expect.arrayContaining(["Error", "DUPLICATE_SOURCE"]));
    expect(fetched).toHaveLength(2);
  });

  it("deduplicates equivalent claims and evidence links", async () => {
    const deps = dependencies();
    const cassettes = (deps.modelGateway as unknown as { cassettes: Record<string, unknown> }).cassettes;
    const gateway = new ReplayModelGateway({
      ...cassettes,
      "quick-extract": (request: ModelRequest<unknown>) => {
        const input = JSON.parse(request.input) as { passages: Array<{ snapshotId: string; blockId: string; text: string }> };
        const passage = input.passages.find((item) => item.text.startsWith("If key"))!;
        const claim = { statement: "dict.pop removes a key.", normalizedStatement: "dict pop removes key", claimType: "PROCEDURE", importance: "DECISIVE", scope: {}, evidence: [{ snapshotId: passage.snapshotId, blockId: passage.blockId, exactExcerpt: passage.text, paraphrase: "pop removes", stance: "SUPPORTS", relevance: "DIRECT" }] };
        return { claims: [claim, { ...claim, statement: "dict.pop removes the key." }] };
      }
    });
    const result = await runQuickSearch({ question: "Python dict pop", requestedMode: "QUICK" }, { ...deps, modelGateway: gateway });
    expect(result.bundle.claims).toHaveLength(1);
    expect(result.bundle.evidence).toHaveLength(1);
    expect(result.bundle.claimEvidence).toHaveLength(1);
  });

  it("runs at most one targeted supplemental query and closes the evidence gap", async () => {
    const calls: string[] = [];
    const searchProvider: SearchProvider = {
      async search(input: SearchProviderInput) {
        calls.push(input.query);
        const official = input.query.includes("official");
        return { candidates: [{ url: official ? "https://docs.python.org/official" : "https://example.com/community", title: official ? "Official docs" : "Community", snippet: "", rank: 1, provider: "test", language: "en" }], provider: "test", requestId: input.requestId, durationMs: 1, moreResultsAvailable: false };
      }
    };
    const modelGateway = new ReplayModelGateway({
      "quick-intent": { normalizedQuestion: "Python dict pop", selectedMode: "QUICK", modeConfidence: 0.99, entities: ["Python"], constraints: {}, freshnessRequirement: "VERSIONED", ambiguityNotes: [], assumptions: [] },
      "quick-plan": { objective: "Verify pop", steps: [{ goal: "Find evidence", queries: ["community dict pop", "official dict pop"], preferredSourceTypes: ["OFFICIAL_DOC"], completionCriteria: ["direct evidence"] }], stopConditions: ["verified"] },
      "quick-extract": (request: ModelRequest<unknown>) => {
        const input = JSON.parse(request.input) as { passages: Array<{ snapshotId: string; blockId: string; text: string }> };
        const evidence = input.passages.filter((item) => item.text.includes("dict.pop removes"));
        return { claims: evidence.map((item) => ({ statement: "dict.pop removes a key.", normalizedStatement: "dict pop removes key", claimType: "PROCEDURE", importance: "DECISIVE", scope: {}, evidence: [{ snapshotId: item.snapshotId, blockId: item.blockId, exactExcerpt: item.text, paraphrase: "pop removes", stance: "SUPPORTS", relevance: item.text.includes("Official") ? "DIRECT" : "PARTIAL" }] })) };
      },
      "quick-synthesis": { title: "dict.pop", summary: "grounded", answer: "unsupported model prose", bullets: [{ text: "pop", claimIndexes: [0] }], limitations: [] }
    });
    const contentFetcher = {
      fetch: async (source: { url: string }) => ({ requestedUrl: source.url, finalUrl: source.url, statusCode: 200, contentType: "text/html", body: `<title>Doc</title><p>${source.url.includes("docs.python") ? "Official: " : "Community: "}dict.pop removes a key.</p>`, fetchedAt: "2026-08-12T08:00:00.000Z", redirectChain: [], truncated: false })
    };
    const result = await runQuickSearch({ question: "Python dict pop", requestedMode: "QUICK" }, { searchProvider, modelGateway, contentFetcher });
    expect(calls).toEqual(["community dict pop", "official dict pop"]);
    expect(result.queries.map((query) => query.round)).toEqual([1, 2]);
    expect(result.bundle.claims).toHaveLength(1);
    expect(result.bundle.result.overallConfidence).toBe("HIGH");
    expect(result.bundle.result.answerSections[0]?.nodes[0]).toMatchObject({ text: expect.stringContaining("dict.pop removes a key.") });
    expect(JSON.stringify(result.bundle.result)).not.toContain("unsupported model prose");
  });

  it("fails explicitly when every discovered source is unfetchable", async () => {
    const deps = dependencies();
    await expect(runQuickSearch({ question: "Python dict pop", requestedMode: "QUICK" }, {
      ...deps,
      contentFetcher: { fetch: async () => { throw new Error("unavailable"); } }
    })).rejects.toMatchObject({ code: "NO_FETCHABLE_SOURCES" });
  });
});
