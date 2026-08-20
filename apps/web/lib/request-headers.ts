/**
 * Marker required by SearchOS mutation routes.
 *
 * It intentionally is not a secret or an authentication token. Browsers cannot
 * attach it from a cross-origin page without a preflight request, and the
 * server additionally verifies Origin when one is present.
 */
export const searchOsMutationRequestHeaderName = "X-SearchOS-Request";
export const searchOsMutationRequestHeaders = {
  [searchOsMutationRequestHeaderName]: "1"
} as const;
