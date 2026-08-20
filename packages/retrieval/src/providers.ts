import type { SearchProvider, SearchProviderInput, SearchProviderResult, SourceCandidate } from "@searchos/domain";
import { z } from "zod";
import { RetrievalError } from "./errors";

const BraveResponseSchema = z.object({
  query: z.object({ more_results_available: z.boolean().optional() }).passthrough().optional(),
  web: z.object({ results: z.array(z.object({ title: z.string(), url: z.string().url(), description: z.string().optional(), language: z.string().optional(), age: z.string().optional() }).passthrough()) }).optional()
}).passthrough();

const TavilyResponseSchema = z.object({
  results: z.array(z.object({
    title: z.string(), url: z.string().url(), content: z.string().optional(),
    score: z.number().optional(), published_date: z.string().optional()
  }).passthrough()),
  request_id: z.string().optional()
}).passthrough();

function normalizePublishedAt(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

export class ReplaySearchProvider implements SearchProvider {
  constructor(private readonly candidates: readonly SourceCandidate[]) {}
  async search(input: SearchProviderInput): Promise<SearchProviderResult> {
    if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return { candidates: this.candidates.slice(0, input.count), provider: "replay", requestId: input.requestId, moreResultsAvailable: false };
  }
}

export class BraveSearchProvider implements SearchProvider {
  constructor(private readonly apiKey: string, private readonly fetchImpl: typeof fetch = fetch) {}
  async search(input: SearchProviderInput): Promise<SearchProviderResult> {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", input.query);
    url.searchParams.set("count", String(Math.min(20, input.count)));
    url.searchParams.set("search_lang", input.language.slice(0, 2));
    if (input.country) url.searchParams.set("country", input.country);
    const freshness = { DAY: "pd", WEEK: "pw", MONTH: "pm", YEAR: "py" } as const;
    if (input.freshness) url.searchParams.set("freshness", freshness[input.freshness]);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: { "X-Subscription-Token": this.apiKey, accept: "application/json" },
        ...(input.signal ? { signal: input.signal } : {})
      });
    }
    catch { throw new RetrievalError("SEARCH_PROVIDER_FAILED", "搜索服务暂时不可用。", true); }
    if (response.status === 429) throw new RetrievalError("SEARCH_RATE_LIMITED", "搜索服务请求过多，请稍后重试。", true);
    if (!response.ok) throw new RetrievalError("SEARCH_PROVIDER_FAILED", `搜索服务返回 HTTP ${response.status}。`, response.status >= 500);
    const parsed = BraveResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new RetrievalError("SEARCH_PROVIDER_FAILED", "搜索服务响应格式无效。", true);
    const candidates = (parsed.data.web?.results ?? []).map((item, index) => ({
      url: item.url, title: item.title, snippet: item.description ?? "", rank: index + 1,
      provider: "brave", ...(item.language ? { language: item.language } : {})
    }));
    return { candidates, provider: "brave", requestId: input.requestId, moreResultsAvailable: parsed.data.query?.more_results_available ?? false };
  }
}

export class TavilySearchProvider implements SearchProvider {
  constructor(private readonly apiKey: string, private readonly fetchImpl: typeof fetch = fetch) {}

  async search(input: SearchProviderInput): Promise<SearchProviderResult> {
    let response: Response;
    try {
      response = await this.fetchImpl("https://api.tavily.com/search", {
        method: "POST",
        headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          query: input.query,
          search_depth: "basic",
          topic: "general",
          max_results: Math.min(20, input.count),
          include_answer: false,
          include_raw_content: false,
          include_images: false
        }),
        ...(input.signal ? { signal: input.signal } : {})
      });
    } catch {
      if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      throw new RetrievalError("SEARCH_PROVIDER_FAILED", "搜索服务暂时不可用。", true);
    }
    if ([429, 432, 433].includes(response.status)) throw new RetrievalError("SEARCH_RATE_LIMITED", "搜索服务额度不足或请求过多，请稍后重试。", true);
    if (!response.ok) throw new RetrievalError("SEARCH_PROVIDER_FAILED", `搜索服务返回 HTTP ${response.status}。`, response.status >= 500);
    let payload: unknown;
    try { payload = await response.json(); }
    catch { throw new RetrievalError("SEARCH_PROVIDER_FAILED", "搜索服务响应格式无效。", true); }
    const parsed = TavilyResponseSchema.safeParse(payload);
    if (!parsed.success) throw new RetrievalError("SEARCH_PROVIDER_FAILED", "搜索服务响应格式无效。", true);
    return {
      candidates: parsed.data.results.map((item, index) => {
        const publishedAt = normalizePublishedAt(item.published_date);
        return {
          url: item.url,
          title: item.title,
          snippet: item.content ?? "",
          rank: index + 1,
          provider: "tavily",
          ...(publishedAt ? { publishedAt } : {})
        };
      }),
      provider: "tavily",
      requestId: parsed.data.request_id ?? input.requestId,
      moreResultsAvailable: parsed.data.results.length >= Math.min(20, input.count)
    };
  }
}
