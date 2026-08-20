import type { ModelCapabilities, ModelGateway, ModelRequest, ModelResult } from "@searchos/domain";
import { ModelGatewayError } from "./errors";
import { parseStructured, providerError, readJson, requestInit, usageFrom } from "./shared";

export interface DeepSeekModelGatewayOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

function deepSeekContent(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const choices = (payload as Record<string, unknown>).choices;
  if (!Array.isArray(choices)) return "";
  const message = choices[0] && typeof choices[0] === "object" ? (choices[0] as Record<string, unknown>).message : undefined;
  return message && typeof message === "object" && typeof (message as Record<string, unknown>).content === "string"
    ? (message as Record<string, unknown>).content as string : "";
}

export class DeepSeekModelGateway implements ModelGateway {
  readonly provider = "deepseek";
  readonly capabilities: ModelCapabilities = { mode: "JSON_OBJECT", usage: true, reasoningOutput: true };
  readonly model: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly options: DeepSeekModelGatewayOptions) {
    this.model = options.model;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = (options.baseUrl ?? "https://api.deepseek.com").replace(/\/$/, "");
  }

  async generateStructured<T>(request: ModelRequest<T>): Promise<ModelResult<T>> {
    const startedAt = performance.now();
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, requestInit(request.signal, {
          model: this.model,
          messages: [
            { role: "system", content: `${request.systemInstruction}\n只返回一个完整、紧凑的 JSON 对象，不要输出 Markdown、代码围栏或解释。目标结构 ${request.outputSchemaName} 的 JSON Schema：${JSON.stringify(request.outputJsonSchema)}${attempt > 0 ? "\n上一次输出未通过 JSON 或 schema 校验。请减少冗余文本，确保所有括号闭合且字段完全符合 schema。" : ""}` },
            { role: "user", content: request.input }
          ],
          response_format: { type: "json_object" }, temperature: 0, max_tokens: request.maxOutputTokens, stream: false
        }, { authorization: `Bearer ${this.options.apiKey}`, "content-type": "application/json" }));
      } catch {
        if (request.signal?.aborted) throw new ModelGatewayError("MODEL_ABORTED", "模型调用已取消。", false);
        throw new ModelGatewayError("MODEL_PROVIDER_FAILED", "无法连接模型服务。", true);
      }
      if (!response.ok) throw providerError(response);
      const payload = await readJson(response);
      try {
        const usage = usageFrom(payload);
        return {
          data: parseStructured(deepSeekContent(payload), request), provider: this.provider, model: this.model,
          responseId: typeof (payload as Record<string, unknown>).id === "string" ? (payload as Record<string, unknown>).id as string : crypto.randomUUID(),
          durationMs: Math.round(performance.now() - startedAt), ...(usage ? { usage } : {}),
          capabilityMode: "JSON_OBJECT"
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof ModelGatewayError ? lastError : new ModelGatewayError("MODEL_OUTPUT_INVALID", "模型输出无效。", false);
  }
}
