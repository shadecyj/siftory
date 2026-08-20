export type ModelGatewayErrorCode =
  | "MODEL_PROVIDER_FAILED"
  | "MODEL_RATE_LIMITED"
  | "MODEL_OUTPUT_INVALID"
  | "MODEL_ABORTED";

export class ModelGatewayError extends Error {
  constructor(
    readonly code: ModelGatewayErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly status?: number
  ) {
    super(message);
    this.name = "ModelGatewayError";
  }
}
