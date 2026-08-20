import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { DeepSeekModelGateway, OpenAIModelGateway, ReplayModelGateway } from "./index";

const Output = z.object({ answer: z.string() }).strict();
const request = {
  operation: "quick-test", promptVersion: "test-v1", systemInstruction: "Return JSON.", input: "Question",
  outputSchemaName: "quick_test", outputJsonSchema: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"], additionalProperties: false },
  parse: (value: unknown) => Output.parse(value), maxOutputTokens: 100
};

describe("model gateways", () => {
  it("replays locally without quota", async () => {
    const gateway = new ReplayModelGateway({ "quick-test": { answer: "ok" } });
    await expect(gateway.generateStructured(request)).resolves.toMatchObject({ data: { answer: "ok" }, capabilityMode: "REPLAY" });
  });

  it("uses OpenAI strict JSON schema output", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.text.format).toMatchObject({ type: "json_schema", strict: true });
      return new Response(JSON.stringify({ id: "resp_1", output: [{ content: [{ type: "output_text", text: "{\"answer\":\"openai\"}" }] }], usage: { input_tokens: 2, output_tokens: 3, total_tokens: 5 } }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const gateway = new OpenAIModelGateway({ apiKey: "test", model: "test-model", fetchImpl });
    await expect(gateway.generateStructured(request)).resolves.toMatchObject({ data: { answer: "openai" }, usage: { totalTokens: 5 } });
  });

  it("retries one invalid DeepSeek JSON response and never surfaces reasoning content", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "", reasoning_content: "secret" } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "chat_1", choices: [{ message: { content: "{\"answer\":\"deepseek\"}", reasoning_content: "secret" } }], usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } }), { status: 200 }));
    const gateway = new DeepSeekModelGateway({ apiKey: "test", model: "deepseek-chat", fetchImpl });
    const result = await gateway.generateStructured(request);
    expect(result).toMatchObject({ data: { answer: "deepseek" }, capabilityMode: "JSON_OBJECT" });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body));
    expect(retryBody.temperature).toBe(0);
    expect(retryBody.messages[0].content).toContain("上一次输出未通过");
  });

  it.each([
    ["empty", ""],
    ["truncated", "{\"answer\":"],
    ["schema mismatch", "{\"answer\":1}"],
    ["unknown field", "{\"answer\":\"ok\",\"extra\":true}"]
  ])("fails closed after one retry for %s DeepSeek output", async (_name, content) => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }));
    const gateway = new DeepSeekModelGateway({ apiKey: "test", model: "deepseek-chat", fetchImpl });
    await expect(gateway.generateStructured(request)).rejects.toMatchObject({ code: "MODEL_OUTPUT_INVALID" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([OpenAIModelGateway, DeepSeekModelGateway])("maps provider rate limits for %s", async (Gateway) => {
    const gateway = new Gateway({ apiKey: "test", model: "test", fetchImpl: async () => new Response("{}", { status: 429 }) });
    await expect(gateway.generateStructured(request)).rejects.toMatchObject({ code: "MODEL_RATE_LIMITED", retryable: true });
  });

  it.each([
    [OpenAIModelGateway],
    [DeepSeekModelGateway]
  ])("maps cancellation without leaking the transport error for %s", async (Gateway) => {
    const controller = new AbortController();
    controller.abort();
    const gateway = new Gateway({ apiKey: "test", model: "test", fetchImpl: async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return new Response("{}", { status: 500 });
    } });
    await expect(gateway.generateStructured({ ...request, signal: controller.signal })).rejects.toMatchObject({ code: "MODEL_ABORTED", retryable: false });
  });
});
