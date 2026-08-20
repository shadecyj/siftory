export type LiveModelProvider = "openai" | "deepseek";
export type LiveSearchProvider = "brave" | "tavily";

export type LiveRuntimeConfig = {
  readonly searchProvider: LiveSearchProvider;
  readonly searchApiKey: string;
  readonly modelProvider: LiveModelProvider;
  readonly modelApiKey: string;
  readonly model: string;
  readonly modelBaseUrl?: string;
};

export type LiveConfigurationIssue =
  | "SEARCH_PROVIDER_MISSING"
  | "SEARCH_PROVIDER_UNSUPPORTED"
  | "SEARCH_API_KEY_MISSING"
  | "MODEL_PROVIDER_MISSING"
  | "MODEL_PROVIDER_UNSUPPORTED"
  | "MODEL_API_KEY_MISSING"
  | "MODEL_NAME_MISSING"
  | "MODEL_BASE_URL_INVALID";

export const liveConfigurationPublicMessage = "Live 搜索尚未配置完整，请检查服务端的搜索与模型设置。";

export class LiveRuntimeConfigurationError extends Error {
  readonly code = "PROVIDER_NOT_CONFIGURED";

  constructor(readonly issues: readonly LiveConfigurationIssue[]) {
    super("Live runtime configuration is invalid.");
    this.name = "LiveRuntimeConfigurationError";
  }
}

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

function value(environment: RuntimeEnvironment, name: string): string | undefined {
  const candidate = environment[name]?.trim();
  return candidate ? candidate : undefined;
}

/**
 * A DeepSeek key is sent to `modelBaseUrl` by the Live adapter. Accept only
 * the public HTTPS API endpoint forms we intentionally support in V0.1;
 * arbitrary, HTTP, credential-bearing, or query-bearing URLs could turn an
 * environment typo into a credential exfiltration path.
 */
function validBaseUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:"
      && parsed.hostname.toLowerCase() === "api.deepseek.com"
      && parsed.port === ""
      && !parsed.username
      && !parsed.password
      && !parsed.search
      && !parsed.hash
      && ["", "/", "/v1", "/v1/"].includes(parsed.pathname);
  } catch {
    return false;
  }
}

export function parseLiveRuntimeConfig(environment: RuntimeEnvironment): LiveRuntimeConfig {
  const issues: LiveConfigurationIssue[] = [];
  const searchProviderValue = value(environment, "SEARCH_PROVIDER")?.toLowerCase();
  const searchApiKey = searchProviderValue === "tavily"
    ? value(environment, "TAVILY_API_KEY")
    : searchProviderValue === "brave" ? value(environment, "BRAVE_SEARCH_API_KEY") : undefined;
  const providerValue = value(environment, "MODEL_PROVIDER")?.toLowerCase();

  if (!searchProviderValue) issues.push("SEARCH_PROVIDER_MISSING");
  else if (searchProviderValue !== "brave" && searchProviderValue !== "tavily") issues.push("SEARCH_PROVIDER_UNSUPPORTED");
  if (!searchApiKey) issues.push("SEARCH_API_KEY_MISSING");
  if (!providerValue) issues.push("MODEL_PROVIDER_MISSING");
  else if (providerValue !== "openai" && providerValue !== "deepseek") issues.push("MODEL_PROVIDER_UNSUPPORTED");

  if (providerValue === "deepseek") {
    const modelApiKey = value(environment, "DEEPSEEK_API_KEY");
    const model = value(environment, "DEEPSEEK_MODEL");
    const modelBaseUrl = value(environment, "DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com";
    if (!modelApiKey) issues.push("MODEL_API_KEY_MISSING");
    if (!model) issues.push("MODEL_NAME_MISSING");
    if (!validBaseUrl(modelBaseUrl)) issues.push("MODEL_BASE_URL_INVALID");
    if (issues.length > 0) throw new LiveRuntimeConfigurationError(issues);
    return { searchProvider: searchProviderValue as LiveSearchProvider, searchApiKey: searchApiKey!, modelProvider: "deepseek", modelApiKey: modelApiKey!, model: model!, modelBaseUrl };
  }

  if (providerValue === "openai") {
    const modelApiKey = value(environment, "OPENAI_API_KEY");
    const model = value(environment, "OPENAI_MODEL");
    if (!modelApiKey) issues.push("MODEL_API_KEY_MISSING");
    if (!model) issues.push("MODEL_NAME_MISSING");
    if (issues.length > 0) throw new LiveRuntimeConfigurationError(issues);
    return { searchProvider: searchProviderValue as LiveSearchProvider, searchApiKey: searchApiKey!, modelProvider: "openai", modelApiKey: modelApiKey!, model: model! };
  }

  throw new LiveRuntimeConfigurationError(issues);
}
