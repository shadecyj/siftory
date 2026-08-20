import type { ModelRequest, ModelUsage } from "@searchos/domain";
import { ModelGatewayError } from "./errors";

export function parseStructured<T>(text: string, request: ModelRequest<T>): T {
  if (!text.trim()) throw new ModelGatewayError("MODEL_OUTPUT_INVALID", "模型返回了空内容。", true);
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new ModelGatewayError("MODEL_OUTPUT_INVALID", "模型返回的内容不是有效 JSON。", true); }
  try { return request.parse(value); }
  catch { throw new ModelGatewayError("MODEL_OUTPUT_INVALID", "模型输出未通过本地结构校验。", true); }
}

export function responseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text;
  const output = Array.isArray(record.output) ? record.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content) ? (item as Record<string, unknown>).content as unknown[] : [];
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string") return (part as Record<string, unknown>).text as string;
    }
  }
  return "";
}

export function usageFrom(payload: unknown): ModelUsage | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const usage = (payload as Record<string, unknown>).usage;
  if (!usage || typeof usage !== "object") return undefined;
  const item = usage as Record<string, unknown>;
  const number = (key: string) => typeof item[key] === "number" ? item[key] as number : undefined;
  const inputTokens = number("input_tokens") ?? number("prompt_tokens");
  const outputTokens = number("output_tokens") ?? number("completion_tokens");
  const totalTokens = number("total_tokens");
  const result: ModelUsage = {
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(totalTokens !== undefined ? { totalTokens } : {})
  };
  return Object.keys(result).length > 0 ? result : undefined;
}

export async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new ModelGatewayError("MODEL_PROVIDER_FAILED", "模型服务返回了无法解析的响应。", response.status >= 500, response.status); }
}

export function providerError(response: Response): ModelGatewayError {
  if (response.status === 429) return new ModelGatewayError("MODEL_RATE_LIMITED", "模型服务请求过多，请稍后重试。", true, 429);
  return new ModelGatewayError("MODEL_PROVIDER_FAILED", `模型服务返回 HTTP ${response.status}。`, response.status >= 500, response.status);
}

export function requestInit(signal: AbortSignal | undefined, body: unknown, headers: Record<string, string>): RequestInit {
  return { method: "POST", headers, body: JSON.stringify(body), ...(signal ? { signal } : {}) };
}
