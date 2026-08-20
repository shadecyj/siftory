import { describe, expect, it } from "vitest";
import { searchOsMutationRequestHeaderName } from "../request-headers";
import { rejectUntrustedMutationRequest } from "./request-security";

function mutationRequest(url: string, headers: HeadersInit = {}): Request {
  return new Request(url, {
    method: "POST",
    headers,
    body: "locale=en-US"
  });
}

describe("loopback mutation request guard", () => {
  it("rejects a cross-origin text/plain request without the dedicated marker", async () => {
    const rejected = rejectUntrustedMutationRequest(mutationRequest("http://127.0.0.1:4311/api/search-tasks", {
      origin: "https://untrusted.example",
      "content-type": "text/plain;charset=UTF-8"
    }));

    expect(rejected?.status).toBe(403);
    expect(await rejected?.json()).toEqual({
      error: expect.objectContaining({ code: "INVALID_REQUEST", retryable: false })
    });
  });

  it("rejects a same-origin mutation that is missing the dedicated marker", () => {
    const rejected = rejectUntrustedMutationRequest(mutationRequest("http://127.0.0.1:4311/api/search-tasks", {
      origin: "http://127.0.0.1:4311",
      "content-type": "application/json"
    }));

    expect(rejected?.status).toBe(403);
  });

  it("rejects a cross-origin mutation even if the marker was added", () => {
    const rejected = rejectUntrustedMutationRequest(mutationRequest("http://127.0.0.1:4311/api/search-tasks", {
      origin: "https://untrusted.example",
      [searchOsMutationRequestHeaderName]: "1"
    }));

    expect(rejected?.status).toBe(403);
  });

  it("accepts a same-origin browser request and a marked Node smoke request", () => {
    const sameOrigin = rejectUntrustedMutationRequest(mutationRequest("http://127.0.0.1:4311/api/search-tasks", {
      origin: "http://127.0.0.1:4311",
      [searchOsMutationRequestHeaderName]: "1"
    }));
    const nodeSmoke = rejectUntrustedMutationRequest(mutationRequest("http://127.0.0.1:4311/api/search-tasks", {
      [searchOsMutationRequestHeaderName]: "1"
    }));

    expect(sameOrigin).toBeNull();
    expect(nodeSmoke).toBeNull();
  });

  it("uses the browser Host header when Next reports an internal localhost URL", () => {
    const accepted = rejectUntrustedMutationRequest(mutationRequest("http://localhost:4311/api/search-tasks", {
      origin: "http://127.0.0.1:4311",
      host: "127.0.0.1:4311",
      [searchOsMutationRequestHeaderName]: "1"
    }));

    expect(accepted).toBeNull();
  });
});
