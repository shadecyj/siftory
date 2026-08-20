import { searchOsMutationRequestHeaderName } from "../request-headers";

/**
 * Reject browser-triggered cross-origin writes to the local SearchOS runtime.
 *
 * `X-SearchOS-Request` is a deliberate non-simple header. A third-party page
 * therefore cannot issue an accepted write without CORS permission, which this
 * application never grants. The Origin comparison is a second browser boundary.
 * Command-line smoke tests may omit Origin, but must always send the marker.
 */
export function rejectUntrustedMutationRequest(request: Request): Response | null {
  if (request.headers.get(searchOsMutationRequestHeaderName) !== "1") {
    return rejectedMutationResponse();
  }

  const origin = request.headers.get("origin");
  if (origin === null) return null;

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    // Next may construct Request.url from its configured internal hostname
    // (`localhost`) even when the browser reached a loopback address such as
    // `127.0.0.1`. Host is supplied by the browser and is the target host;
    // use it when present while retaining the protocol comparison.
    const targetHost = request.headers.get("host") ?? requestUrl.host;
    if (originUrl.protocol !== requestUrl.protocol || originUrl.host !== targetHost) return rejectedMutationResponse();
  } catch {
    return rejectedMutationResponse();
  }

  return null;
}

function rejectedMutationResponse(): Response {
  // Keep the response deliberately generic: it must not disclose runtime
  // configuration, accepted origins, or whether a target resource exists.
  return Response.json({
    error: {
      code: "INVALID_REQUEST",
      stage: null,
      retryable: false,
      publicMessage: "请求未获授权。",
      retainedObjectCounts: {}
    }
  }, {
    status: 403,
    headers: { "cache-control": "no-store" }
  });
}
