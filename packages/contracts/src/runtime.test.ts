import { describe, expect, it } from "vitest";
import { ApiErrorResponseSchema, CreateSearchRequestSchema, QuickExtractionOutputSchema, RuntimeProfileStatusSchema } from "./index";

describe("Round 2 boundary contracts", () => {
  it("rejects unknown request fields", () => {
    expect(CreateSearchRequestSchema.safeParse({ question: "What is RAG?", requestedMode: "AUTO", apiKey: "secret" }).success).toBe(false);
  });

  it("defaults and validates the requested output locale", () => {
    expect(CreateSearchRequestSchema.parse({ question: "What is RAG?" }).outputLocale).toBe("zh-CN");
    expect(CreateSearchRequestSchema.parse({ question: "What is RAG?", outputLocale: "en-US" }).outputLocale).toBe("en-US");
    expect(CreateSearchRequestSchema.safeParse({ question: "What is RAG?", outputLocale: "fr-FR" }).success).toBe(false);
  });

  it("rejects empty, oversized, and unsafe URL questions", () => {
    expect(CreateSearchRequestSchema.safeParse({ question: " ", requestedMode: "AUTO" }).success).toBe(false);
    expect(CreateSearchRequestSchema.safeParse({ question: "x".repeat(4001), requestedMode: "AUTO" }).success).toBe(false);
    expect(CreateSearchRequestSchema.safeParse({ question: "总结 http://127.0.0.1/admin", requestedMode: "AUTO" }).success).toBe(false);
    expect(CreateSearchRequestSchema.safeParse({ question: "读取 file://server/private", requestedMode: "AUTO" }).success).toBe(false);
  });

  it("rejects unanchored extraction output", () => {
    expect(QuickExtractionOutputSchema.safeParse({ claims: [{
      statement: "RAG retrieves context.", normalizedStatement: "rag retrieves context", claimType: "FACT",
      importance: "DECISIVE", scope: {}, evidence: [{ exactExcerpt: "missing block", paraphrase: "x", stance: "SUPPORTS", relevance: "DIRECT" }]
    }] }).success).toBe(false);
  });

  it("keeps public errors structured and secret-free", () => {
    const parsed = ApiErrorResponseSchema.parse({ error: {
      code: "PROVIDER_NOT_CONFIGURED", stage: null, retryable: false,
      publicMessage: "当前实时模型尚未配置。", retainedObjectCounts: {}
    } });
    expect(JSON.stringify(parsed)).not.toContain("API_KEY");
  });

  it("keeps runtime status intentionally credential-free", () => {
    const parsed = RuntimeProfileStatusSchema.parse({
      runtimeMode: "live",
      searchProvider: "tavily",
      modelProvider: "deepseek",
      model: "deepseek-chat",
      modelBaseUrl: "https://api.deepseek.com",
      searchKeyConfigured: true,
      modelKeyConfigured: true,
      validationState: "VERIFIED",
      lifecycleState: "ACTIVE",
      restartRequired: false,
      activeRunCount: 0,
      lastValidatedAt: "2026-08-20T00:00:00.000Z",
      publicFailureCode: null,
      revision: 1
    });
    expect(JSON.stringify(parsed)).not.toMatch(/secret|api[_-]?key/i);
    expect(RuntimeProfileStatusSchema.safeParse({ ...parsed, modelApiKey: "forbidden" }).success).toBe(false);
  });
});
