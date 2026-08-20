import type { ModelCapabilities, ModelGateway, ModelRequest, ModelResult } from "@searchos/domain";

type ReplayValue = unknown | ((request: ModelRequest<unknown>) => unknown);

export class ReplayModelGateway implements ModelGateway {
  readonly provider = "replay";
  readonly model = "cassette-v1";
  readonly capabilities: ModelCapabilities = { mode: "REPLAY", usage: true, reasoningOutput: false };

  constructor(private readonly cassettes: Readonly<Record<string, ReplayValue>>) {}

  async generateStructured<T>(request: ModelRequest<T>): Promise<ModelResult<T>> {
    if (request.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const startedAt = performance.now();
    const cassette = this.cassettes[request.operation];
    if (cassette === undefined) throw new Error(`Missing replay cassette for ${request.operation}.`);
    const value = typeof cassette === "function" ? cassette(request as ModelRequest<unknown>) : structuredClone(cassette);
    return {
      data: request.parse(value), provider: this.provider, model: this.model,
      responseId: `replay-${request.operation}`, durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, capabilityMode: "REPLAY"
    };
  }
}
