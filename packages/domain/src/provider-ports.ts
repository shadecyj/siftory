export interface SearchProviderInput {
  readonly query: string;
  readonly sourceScope: readonly string[];
  readonly language: string;
  readonly country?: string;
  readonly freshness?: "DAY" | "WEEK" | "MONTH" | "YEAR";
  readonly count: number;
  readonly requestId: string;
  readonly signal?: AbortSignal;
}

export interface SourceCandidate {
  readonly url: string;
  readonly title: string;
  readonly snippet: string;
  readonly rank: number;
  readonly provider: string;
  readonly publishedAt?: string;
  readonly language?: string;
}

export interface SearchProviderResult {
  readonly candidates: readonly SourceCandidate[];
  readonly provider: string;
  readonly requestId: string;
  readonly moreResultsAvailable: boolean;
}

export interface SourceSnapshotInput {
  readonly requestedUrl: string;
  readonly finalUrl: string;
  readonly statusCode: number;
  readonly contentType: string;
  readonly body: string;
  readonly fetchedAt: string;
  readonly redirectChain: readonly string[];
  readonly truncated: boolean;
}

export interface SearchProvider {
  search(input: SearchProviderInput): Promise<SearchProviderResult>;
}

export interface ContentFetcher {
  fetch(source: SourceCandidate, signal?: AbortSignal): Promise<SourceSnapshotInput>;
}

export type ModelCapabilityMode = "REPLAY" | "NATIVE_JSON_SCHEMA" | "JSON_OBJECT";

export interface ModelCapabilities {
  readonly mode: ModelCapabilityMode;
  readonly usage: boolean;
  readonly reasoningOutput: boolean;
}

export interface ModelRequest<T> {
  readonly operation: string;
  readonly promptVersion: string;
  readonly systemInstruction: string;
  readonly input: string;
  readonly outputSchemaName: string;
  readonly outputJsonSchema: Readonly<Record<string, unknown>>;
  readonly parse: (value: unknown) => T;
  readonly maxOutputTokens: number;
  readonly signal?: AbortSignal;
}

export interface ModelUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
  readonly cacheReadTokens?: number;
}

export interface ModelResult<T> {
  readonly data: T;
  readonly provider: string;
  readonly model: string;
  readonly responseId: string;
  readonly durationMs: number;
  readonly usage?: ModelUsage;
  readonly capabilityMode: ModelCapabilityMode;
}

export interface ModelGateway {
  readonly provider: string;
  readonly model: string;
  readonly capabilities: ModelCapabilities;
  generateStructured<T>(request: ModelRequest<T>): Promise<ModelResult<T>>;
}
