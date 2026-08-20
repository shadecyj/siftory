import type { ModelCapabilities, ModelGateway, ModelRequest, ModelResult } from "@searchos/domain";
import { ModelGatewayError } from "./errors";
import { parseStructured, providerError, readJson, requestInit, responseText, usageFrom } from "./shared";

export interface OpenAIModelGatewayOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

export class OpenAIModelGateway implements ModelGateway {
  readonly provider = "openai";
  readonly capabilities: ModelCapabilities = { mode: "NATIVE_JSON_SCHEMA", usage: true, reasoningOutput: false };
  readonly model: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly options: OpenAIModelGatewayOptions) {
    this.model = options.model;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  }

  async generateStructured<T>(request: ModelRequest<T>): Promise<ModelResult<T>> {
    const startedAt = performance.now();
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/responses`, requestInit(request.signal, {
        model: this.model,
        input: [
          { role: "system", content: request.systemInstruction },
          { role: "user", content: request.input }
        ],
        text: { format: { type: "json_schema", name: request.outputSchemaName, schema: request.outputJsonSchema, strict: true } },
        max_output_tokens: request.maxOutputTokens
      }, { authorization: `Bearer ${this.options.apiKey}`, "content-type": "application/json" }));
    } catch {
      if (request.signal?.aborted) throw new ModelGatewayError("MODEL_ABORTED", "模型调用已取消。", false);
      throw new ModelGatewayError("MODEL_PROVIDER_FAILED", "无法连接模型服务。", true);
    }
    if (!response.ok) throw providerError(response);
    const payload = await readJson(response);
    const usage = usageFrom(payload);
    return {
      data: parseStructured(responseText(payload), request), provider: this.provider, model: this.model,
      responseId: typeof (payload as Record<string, unknown>)?.id === "string" ? (payload as Record<string, unknown>).id as string : crypto.randomUUID(),
      durationMs: Math.round(performance.now() - startedAt), ...(usage ? { usage } : {}),
      capabilityMode: "NATIVE_JSON_SCHEMA"
    };
  }
}
