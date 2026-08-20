export class RetrievalError extends Error {
  constructor(
    readonly code: "FETCH_BLOCKED" | "FETCH_TIMEOUT" | "UNSUPPORTED_CONTENT_TYPE" | "SEARCH_PROVIDER_FAILED" | "SEARCH_RATE_LIMITED",
    message: string,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = "RetrievalError";
  }
}
