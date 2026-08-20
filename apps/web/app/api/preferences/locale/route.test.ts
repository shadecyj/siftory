import { describe, expect, it } from "vitest";
import { searchOsMutationRequestHeaderName } from "../../../../lib/request-headers";
import { POST } from "./route";

describe("POST /api/preferences/locale mutation guard", () => {
  it("rejects a cross-origin form-style request before parsing its body", async () => {
    const response = await POST(new Request("http://127.0.0.1:4311/api/preferences/locale", {
      method: "POST",
      headers: {
        origin: "https://untrusted.example",
        "content-type": "text/plain;charset=UTF-8"
      },
      body: "locale=en-US"
    }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: expect.objectContaining({ code: "INVALID_REQUEST" }) });
  });

  it("allows a marked same-origin request through to normal request validation", async () => {
    const response = await POST(new Request("http://127.0.0.1:4311/api/preferences/locale", {
      method: "POST",
      headers: {
        origin: "http://127.0.0.1:4311",
        [searchOsMutationRequestHeaderName]: "1",
        "content-type": "application/json"
      },
      body: "not-json"
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "INVALID_LOCALE" });
  });
});
