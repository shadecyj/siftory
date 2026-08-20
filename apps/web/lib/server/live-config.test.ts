import { describe, expect, it } from "vitest";
import { LiveRuntimeConfigurationError, liveConfigurationPublicMessage, parseLiveRuntimeConfig } from "./live-config";

describe("live runtime configuration", () => {
  it("selects OpenAI without requiring DeepSeek credentials", () => {
    expect(parseLiveRuntimeConfig({
      SEARCH_PROVIDER: " brave ", BRAVE_SEARCH_API_KEY: " brave-secret ", MODEL_PROVIDER: " OPENAI ",
      OPENAI_API_KEY: " openai-secret ", OPENAI_MODEL: " gpt-test "
    })).toEqual({
      searchProvider: "brave", searchApiKey: "brave-secret", modelProvider: "openai", modelApiKey: "openai-secret", model: "gpt-test"
    });
  });

  it("selects Tavily and DeepSeek without requiring Brave or OpenAI credentials", () => {
    expect(parseLiveRuntimeConfig({
      SEARCH_PROVIDER: "tavily", TAVILY_API_KEY: "tavily-secret", MODEL_PROVIDER: "deepseek",
      DEEPSEEK_API_KEY: "deepseek-secret", DEEPSEEK_MODEL: "deepseek-chat"
    })).toEqual({
      searchProvider: "tavily", searchApiKey: "tavily-secret", modelProvider: "deepseek", modelApiKey: "deepseek-secret",
      model: "deepseek-chat", modelBaseUrl: "https://api.deepseek.com"
    });
  });

  it.each([
    [{ SEARCH_PROVIDER: "brave", BRAVE_SEARCH_API_KEY: "search", MODEL_PROVIDER: "openai", OPENAI_API_KEY: "key" }, "MODEL_NAME_MISSING"],
    [{ SEARCH_PROVIDER: "brave", BRAVE_SEARCH_API_KEY: "search", MODEL_PROVIDER: "other" }, "MODEL_PROVIDER_UNSUPPORTED"],
    [{ SEARCH_PROVIDER: "tavily", MODEL_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "key", DEEPSEEK_MODEL: "model" }, "SEARCH_API_KEY_MISSING"],
    [{ SEARCH_PROVIDER: "other", MODEL_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "key", DEEPSEEK_MODEL: "model" }, "SEARCH_PROVIDER_UNSUPPORTED"],
    [{ SEARCH_PROVIDER: "brave", BRAVE_SEARCH_API_KEY: "search", MODEL_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "key", DEEPSEEK_MODEL: "model", DEEPSEEK_BASE_URL: "not a url" }, "MODEL_BASE_URL_INVALID"],
    [{ SEARCH_PROVIDER: "brave", BRAVE_SEARCH_API_KEY: "search", MODEL_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "key", DEEPSEEK_MODEL: "model", DEEPSEEK_BASE_URL: "http://api.deepseek.com" }, "MODEL_BASE_URL_INVALID"],
    [{ SEARCH_PROVIDER: "brave", BRAVE_SEARCH_API_KEY: "search", MODEL_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "key", DEEPSEEK_MODEL: "model", DEEPSEEK_BASE_URL: "https://example.invalid/v1" }, "MODEL_BASE_URL_INVALID"],
    [{ SEARCH_PROVIDER: "brave", BRAVE_SEARCH_API_KEY: "search", MODEL_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "key", DEEPSEEK_MODEL: "model", DEEPSEEK_BASE_URL: "https://api.deepseek.com/v1/base-url-path-sentinel" }, "MODEL_BASE_URL_INVALID"],
    [{ SEARCH_PROVIDER: "brave", BRAVE_SEARCH_API_KEY: "search", MODEL_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "key", DEEPSEEK_MODEL: "model", DEEPSEEK_BASE_URL: "https://key@api.deepseek.com/v1" }, "MODEL_BASE_URL_INVALID"],
    [{ SEARCH_PROVIDER: "brave", BRAVE_SEARCH_API_KEY: "search", MODEL_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "key", DEEPSEEK_MODEL: "model", DEEPSEEK_BASE_URL: "https://api.deepseek.com/v1?token=not-for-request" }, "MODEL_BASE_URL_INVALID"]
  ])("fails closed for invalid configuration", (environment, issue) => {
    expect(() => parseLiveRuntimeConfig(environment)).toThrowError(LiveRuntimeConfigurationError);
    try { parseLiveRuntimeConfig(environment); }
    catch (error) {
      expect(error).toMatchObject({ issues: expect.arrayContaining([issue]) });
      expect((error as Error).message).not.toContain("search");
      expect((error as Error).message).not.toContain("key");
    }
  });

  it("uses a stable public message without technical variable names", () => {
    expect(liveConfigurationPublicMessage).not.toMatch(/API_KEY|MODEL_PROVIDER|\.env/);
  });
});
