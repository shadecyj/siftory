import {
  RuntimeProfileStatusSchema,
  RuntimeProfileStatusResponseSchema,
  RuntimeValidationStateSchema,
  type RuntimeProfileStatus,
  type RuntimeProfileStatusResponse,
  type SearchProviderKind,
  type ModelProvider
} from "@searchos/contracts";
import { getActiveRuntimeRunCount } from "../../../../lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

// The status endpoint is a browser-visible redaction boundary. A model name
// is useful metadata only when it is one of the V0.1 models we intentionally
// surface; accepting a broad `gpt-*` / `deepseek-*` pattern can still reflect
// a token accidentally pasted into a model environment variable.
const displayableDeepSeekModels = new Set(["deepseek-chat", "deepseek-reasoner"]);
const displayableOpenAiModels = new Set([
  "gpt-4.1-mini",
  "gpt-4.1",
  "gpt-4o-mini",
  "gpt-4o",
  "o3-mini",
  "o4-mini"
]);

function environmentValue(environment: RuntimeEnvironment, name: string): string | undefined {
  const candidate = environment[name]?.trim();
  return candidate ? candidate : undefined;
}

function searchProviderFromEnvironment(environment: RuntimeEnvironment): SearchProviderKind | null {
  const provider = environmentValue(environment, "SEARCH_PROVIDER")?.toLowerCase();
  return provider === "tavily" || provider === "brave" ? provider : null;
}

function modelProviderFromEnvironment(environment: RuntimeEnvironment): ModelProvider | null {
  const provider = environmentValue(environment, "MODEL_PROVIDER")?.toLowerCase();
  return provider === "deepseek" || provider === "openai" ? provider : null;
}

function safeModelName(environment: RuntimeEnvironment, provider: ModelProvider | null, name: string): string | null {
  const model = environmentValue(environment, name);
  if (!model) return null;
  if (provider === "deepseek" && displayableDeepSeekModels.has(model)) return model;
  if (provider === "openai" && displayableOpenAiModels.has(model)) return model;
  return null;
}

function safeBaseUrl(environment: RuntimeEnvironment, name: string): string | null {
  const raw = environmentValue(environment, name);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    // Base URLs are displayed as metadata. Do not reflect an arbitrary host
    // or path back to the browser: a value accidentally pasted with a token
    // in its path would otherwise become a credential disclosure. Live
    // runtime configuration is validated separately; status only exposes the
    // two canonical public DeepSeek endpoint forms.
    if (
      parsed.protocol !== "https:"
      || parsed.username
      || parsed.password
      || parsed.hostname.toLowerCase() !== "api.deepseek.com"
      || parsed.port !== ""
    ) return null;
    if (parsed.pathname === "" || parsed.pathname === "/") return "https://api.deepseek.com/";
    if (parsed.pathname === "/v1" || parsed.pathname === "/v1/") return "https://api.deepseek.com/v1";
    return null;
  } catch {
    return null;
  }
}

/**
 * Builds an explicitly redacted status object for source-run Web deployments.
 * Keep every credential value inside this function: callers only receive the
 * boolean configuration markers below.
 */
export function environmentRuntimeProfileStatus(environment: RuntimeEnvironment = process.env, activeRunCount = 0): RuntimeProfileStatus {
  const runtimeMode = environmentValue(environment, "SEARCHOS_RUNTIME_MODE")?.toLowerCase() === "live" ? "live" : "replay";
  const searchProvider = searchProviderFromEnvironment(environment);
  const modelProvider = modelProviderFromEnvironment(environment);
  const desktopProfileConfigured = environmentValue(environment, "SEARCHOS_DESKTOP_PROFILE_CONFIGURED") === "1";
  const searchKeyConfigured = desktopProfileConfigured || (searchProvider === "tavily"
    ? Boolean(environmentValue(environment, "TAVILY_API_KEY"))
    : searchProvider === "brave" ? Boolean(environmentValue(environment, "BRAVE_SEARCH_API_KEY")) : false);
  const modelKeyConfigured = desktopProfileConfigured || (modelProvider === "deepseek"
    ? Boolean(environmentValue(environment, "DEEPSEEK_API_KEY"))
    : modelProvider === "openai" ? Boolean(environmentValue(environment, "OPENAI_API_KEY")) : false);
  const model = modelProvider === "deepseek"
    ? safeModelName(environment, modelProvider, "DEEPSEEK_MODEL")
    : modelProvider === "openai" ? safeModelName(environment, modelProvider, "OPENAI_MODEL") : null;
  const configuredDeepSeekBaseUrl = environmentValue(environment, "DEEPSEEK_BASE_URL");
  const modelBaseUrl = modelProvider === "deepseek"
    ? configuredDeepSeekBaseUrl ? safeBaseUrl(environment, "DEEPSEEK_BASE_URL") : "https://api.deepseek.com/"
    : null;
  const fullyConfigured = Boolean(searchProvider && modelProvider && searchKeyConfigured && modelKeyConfigured && model);
  const desktopValidation = RuntimeValidationStateSchema.safeParse(environmentValue(environment, "SEARCHOS_DESKTOP_VALIDATION_STATE"));
  const validationState = desktopValidation.success
    ? desktopValidation.data
    : fullyConfigured ? "SAVED_UNVERIFIED" : "NOT_CONFIGURED";
  const revisionCandidate = environmentValue(environment, "SEARCHOS_DESKTOP_PROFILE_REVISION");
  const revision = revisionCandidate && /^\d{1,12}$/.test(revisionCandidate) ? Number(revisionCandidate) : 0;
  const lastValidatedCandidate = environmentValue(environment, "SEARCHOS_DESKTOP_LAST_VALIDATED_AT");
  const lastValidatedDate = lastValidatedCandidate ? new Date(lastValidatedCandidate) : null;
  const lastValidatedAt = lastValidatedDate && !Number.isNaN(lastValidatedDate.getTime()) ? lastValidatedDate.toISOString() : null;

  return RuntimeProfileStatusSchema.parse({
    runtimeMode,
    searchProvider,
    modelProvider,
    model,
    modelBaseUrl,
    searchKeyConfigured,
    modelKeyConfigured,
    validationState,
    lifecycleState: runtimeMode === "live" ? "ACTIVE" : "REPLAY_FALLBACK",
    restartRequired: false,
    activeRunCount,
    lastValidatedAt,
    publicFailureCode: null,
    revision
  });
}

/**
 * The configuration surface is selected from dedicated, non-secret desktop
 * metadata. It must never be inferred from the presence of a credential.
 */
export function runtimeProfileStatusResponse(environment: RuntimeEnvironment = process.env, activeRunCount = 0): RuntimeProfileStatusResponse {
  const configurationSurface = environmentValue(environment, "SEARCHOS_DESKTOP") === "1"
    || environmentValue(environment, "SEARCHOS_DESKTOP_PROFILE_REVISION") !== undefined
    ? "desktop"
    : "environment";
  return RuntimeProfileStatusResponseSchema.parse({
    profile: environmentRuntimeProfileStatus(environment, activeRunCount),
    configurationSurface
  });
}

export async function GET() {
  return Response.json(runtimeProfileStatusResponse(process.env, getActiveRuntimeRunCount()), {
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}
