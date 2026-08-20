import type { ContentFetcher, SourceCandidate, SourceSnapshotInput } from "@searchos/domain";
import { RetrievalError } from "./errors";
import { assertSafePublicUrl } from "./url-policy";

const allowedTypes = ["text/html", "text/plain", "application/xhtml+xml"];

export interface FetcherOptions {
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  readonly maxRedirects?: number;
  readonly userAgent?: string;
  readonly fetchImpl?: typeof fetch;
  readonly urlGuard?: (url: string) => Promise<URL>;
}

export class SafeHttpContentFetcher implements ContentFetcher {
  constructor(private readonly options: FetcherOptions = {}) {}

  async fetch(source: SourceCandidate, signal?: AbortSignal): Promise<SourceSnapshotInput> {
    const timeoutMs = this.options.timeoutMs ?? 8_000;
    const maxBytes = this.options.maxBytes ?? 2_000_000;
    const maxRedirects = this.options.maxRedirects ?? 3;
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const guard = this.options.urlGuard ?? assertSafePublicUrl;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error("fetch timeout")), timeoutMs);
    const onAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", onAbort, { once: true });
    let current = source.url;
    const redirectChain: string[] = [];
    try {
      for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
        await guard(current);
        const response = await fetchImpl(current, {
          redirect: "manual", signal: controller.signal,
          headers: { "user-agent": this.options.userAgent ?? "Siftory/0.1", accept: "text/html,text/plain;q=0.9" }
        });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location || redirects === maxRedirects) throw new RetrievalError("FETCH_BLOCKED", "来源重定向次数过多。", false);
          current = new URL(location, current).toString();
          redirectChain.push(current);
          continue;
        }
        if (!response.ok) throw new RetrievalError("SEARCH_PROVIDER_FAILED", `来源返回 HTTP ${response.status}。`, response.status >= 500);
        const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
        if (!allowedTypes.includes(contentType)) throw new RetrievalError("UNSUPPORTED_CONTENT_TYPE", `暂不支持 ${contentType || "未知"} 内容。`, false);
        const bytes = new Uint8Array(await response.arrayBuffer());
        const truncated = bytes.byteLength > maxBytes;
        const body = new TextDecoder().decode(bytes.slice(0, maxBytes));
        return { requestedUrl: source.url, finalUrl: current, statusCode: response.status, contentType, body, fetchedAt: new Date().toISOString(), redirectChain, truncated };
      }
      throw new RetrievalError("FETCH_BLOCKED", "来源重定向次数过多。", false);
    } catch (error) {
      if (error instanceof RetrievalError) throw error;
      if (controller.signal.aborted) throw new RetrievalError("FETCH_TIMEOUT", signal?.aborted ? "抓取已取消。" : "抓取来源超时。", true);
      throw new RetrievalError("SEARCH_PROVIDER_FAILED", "抓取来源失败。", true);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
  }
}
