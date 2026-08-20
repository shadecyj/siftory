import { describe, expect, it } from "vitest";
import { parseHtmlDocument, SafeHttpContentFetcher, TavilySearchProvider, canonicalizeUrl, isForbiddenIp, verifyExactAnchor } from "./index";

describe("retrieval safety and evidence anchors", () => {
  it("canonicalizes tracking URLs", () => {
    expect(canonicalizeUrl("https://EXAMPLE.com:443/doc?utm_source=x&b=2&a=1#part")).toBe("https://example.com/doc?a=1&b=2");
  });

  it("rejects private network ranges", () => {
    expect(isForbiddenIp("127.0.0.1")).toBe(true);
    expect(isForbiddenIp("10.20.30.40")).toBe(true);
    expect(isForbiddenIp("192.168.1.1")).toBe(true);
    expect(isForbiddenIp("8.8.8.8")).toBe(false);
  });

  it("parses stable blocks and verifies exact excerpts", () => {
    const doc = parseHtmlDocument("00000000-0000-7000-8000-000000000001", "<title>Docs</title><h2>Delete</h2><p>Remove d[key] from d. Raises KeyError when missing.</p>");
    const paragraph = doc.blocks.find((block) => block.kind === "PARAGRAPH")!;
    expect(paragraph.headingPath).toEqual(["Delete"]);
    expect(verifyExactAnchor(doc, paragraph.id, "Remove d[key] from d.")).toBe(true);
    expect(verifyExactAnchor(doc, paragraph.id, "Invented quote")).toBe(false);
  });

  it("revalidates redirects and blocks unsupported MIME", async () => {
    const visited: string[] = [];
    const fetcher = new SafeHttpContentFetcher({
      urlGuard: async (url) => { visited.push(url); return new URL(url); },
      fetchImpl: async (input) => {
        const url = input.toString();
        return url.endsWith("/a")
          ? new Response(null, { status: 302, headers: { location: "/b" } })
          : new Response("%PDF", { status: 200, headers: { "content-type": "application/pdf" } });
      }
    });
    await expect(fetcher.fetch({ url: "https://example.com/a", title: "x", snippet: "", rank: 1, provider: "test" })).rejects.toMatchObject({ code: "UNSUPPORTED_CONTENT_TYPE" });
    expect(visited).toEqual(["https://example.com/a", "https://example.com/b"]);
  });

  it("maps Tavily results to discovery-only source candidates", async () => {
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      expect(input.toString()).toBe("https://api.tavily.com/search");
      expect(init?.headers).toMatchObject({ authorization: "Bearer tavily-secret" });
      expect(JSON.parse(String(init?.body))).toMatchObject({ query: "HTTP 304", search_depth: "basic", include_raw_content: false });
      return new Response(JSON.stringify({
        request_id: "tavily-request",
        results: [{ title: "HTTP Semantics", url: "https://www.rfc-editor.org/rfc/rfc9110", content: "Discovery summary only", score: 0.9, published_date: "2026-08-01" }]
      }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const provider = new TavilySearchProvider("tavily-secret", fetchImpl);
    await expect(provider.search({ query: "HTTP 304", sourceScope: [], language: "zh-CN", count: 5, requestId: "local-request" })).resolves.toEqual({
      candidates: [{ url: "https://www.rfc-editor.org/rfc/rfc9110", title: "HTTP Semantics", snippet: "Discovery summary only", rank: 1, provider: "tavily", publishedAt: "2026-08-01T00:00:00.000Z" }],
      provider: "tavily", requestId: "tavily-request", moreResultsAvailable: false
    });
  });

  it("keeps an unparseable Tavily publication date unknown", async () => {
    const provider = new TavilySearchProvider("tavily-secret", async () => new Response(JSON.stringify({
      results: [{ title: "Undated page", url: "https://example.com/doc", published_date: "recently" }]
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const result = await provider.search({ query: "test", sourceScope: [], language: "zh-CN", count: 5, requestId: "request" });
    expect(result.candidates[0]?.publishedAt).toBeUndefined();
  });

  it("maps Tavily quota responses to a retryable search error", async () => {
    const provider = new TavilySearchProvider("tavily-secret", async () => new Response("{}", { status: 429 }));
    await expect(provider.search({ query: "test", sourceScope: [], language: "zh-CN", count: 5, requestId: "request" })).rejects.toMatchObject({ code: "SEARCH_RATE_LIMITED", retryable: true });
  });
});
