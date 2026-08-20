import { describe, expect, it } from "vitest";
import { environmentRuntimeProfileStatus, runtimeProfileStatusResponse } from "./route";

describe("environmentRuntimeProfileStatus", () => {
  it("returns only redacted configuration status for a complete Live environment", () => {
    const secretSearchKey = "search-sentinel-not-for-response";
    const secretModelKey = "model-sentinel-not-for-response";
    const status = environmentRuntimeProfileStatus({
      SEARCHOS_RUNTIME_MODE: "live",
      SEARCH_PROVIDER: "tavily",
      TAVILY_API_KEY: secretSearchKey,
      MODEL_PROVIDER: "deepseek",
      DEEPSEEK_API_KEY: secretModelKey,
      DEEPSEEK_MODEL: "deepseek-chat",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com/v1?credential=do-not-return",
      SEARCHOS_DESKTOP_VALIDATION_STATE: "VERIFIED",
      SEARCHOS_DESKTOP_PROFILE_REVISION: "12",
      SEARCHOS_DESKTOP_LAST_VALIDATED_AT: "2026-08-20T08:00:00.000Z"
    });

    expect(status).toMatchObject({
      runtimeMode: "live",
      searchProvider: "tavily",
      modelProvider: "deepseek",
      model: "deepseek-chat",
      modelBaseUrl: "https://api.deepseek.com/v1",
      searchKeyConfigured: true,
      modelKeyConfigured: true,
      validationState: "VERIFIED",
      lifecycleState: "ACTIVE",
      revision: 12,
      lastValidatedAt: "2026-08-20T08:00:00.000Z"
    });
    expect(JSON.stringify(status)).not.toContain(secretSearchKey);
    expect(JSON.stringify(status)).not.toContain(secretModelKey);
    expect(JSON.stringify(status)).not.toContain("credential=do-not-return");
  });

  it("reports Replay and missing configuration without inferring a provider from a loose key", () => {
    const status = environmentRuntimeProfileStatus({
      TAVILY_API_KEY: "unused-sentinel"
    });

    expect(status).toMatchObject({
      runtimeMode: "replay",
      searchProvider: null,
      modelProvider: null,
      searchKeyConfigured: false,
      modelKeyConfigured: false,
      validationState: "NOT_CONFIGURED",
      lifecycleState: "REPLAY_FALLBACK"
    });
    expect(JSON.stringify(status)).not.toContain("unused-sentinel");
  });

  it("does not reflect a credential-shaped model value", () => {
    const secretModelValue = "sk-do-not-reflect-this-value";
    const status = environmentRuntimeProfileStatus({
      SEARCH_PROVIDER: "tavily",
      TAVILY_API_KEY: "configured",
      MODEL_PROVIDER: "openai",
      OPENAI_API_KEY: "configured",
      OPENAI_MODEL: secretModelValue
    });

    expect(status.model).toBeNull();
    expect(JSON.stringify(status)).not.toContain(secretModelValue);
  });

  it("does not reflect a provider-prefixed secret pasted into a model value", () => {
    const secretModelValue = "deepseek-model-sentinel-not-for-response";
    const status = environmentRuntimeProfileStatus({
      SEARCH_PROVIDER: "tavily",
      TAVILY_API_KEY: "configured",
      MODEL_PROVIDER: "deepseek",
      DEEPSEEK_API_KEY: "configured",
      DEEPSEEK_MODEL: secretModelValue
    });

    expect(status.model).toBeNull();
    expect(JSON.stringify(status)).not.toContain(secretModelValue);
  });

  it("does not reflect a secret accidentally pasted into a model Base URL path", () => {
    const pathSecret = "base-url-path-sentinel-not-for-response";
    const status = environmentRuntimeProfileStatus({
      SEARCH_PROVIDER: "tavily",
      TAVILY_API_KEY: "configured",
      MODEL_PROVIDER: "deepseek",
      DEEPSEEK_API_KEY: "configured",
      DEEPSEEK_MODEL: "deepseek-chat",
      DEEPSEEK_BASE_URL: `https://api.deepseek.com/v1/${pathSecret}`
    });

    expect(status.modelBaseUrl).toBeNull();
    expect(JSON.stringify(status)).not.toContain(pathSecret);
  });

  it("uses only dedicated desktop metadata to describe the configuration surface", () => {
    expect(runtimeProfileStatusResponse({
      SEARCHOS_DESKTOP_PROFILE_REVISION: "0"
    }).configurationSurface).toBe("desktop");
    expect(runtimeProfileStatusResponse({
      TAVILY_API_KEY: "not-a-surface-signal"
    }).configurationSurface).toBe("environment");
  });

  it("keeps credentials out of the public response wrapper", () => {
    const secret = "wrapper-sentinel-not-for-response";
    const response = runtimeProfileStatusResponse({
      SEARCHOS_DESKTOP: "1",
      SEARCHOS_DESKTOP_PROFILE_CONFIGURED: "1",
      SEARCH_PROVIDER: "tavily",
      TAVILY_API_KEY: secret,
      MODEL_PROVIDER: "deepseek",
      DEEPSEEK_API_KEY: secret,
      DEEPSEEK_MODEL: "deepseek-chat"
    });

    expect(response.configurationSurface).toBe("desktop");
    expect(JSON.stringify(response)).not.toContain(secret);
  });
});
