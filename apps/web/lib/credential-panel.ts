export const CREDENTIAL_PANEL_OPEN_TIMEOUT_MS = 5_000;

export type CredentialPanelInvoker = () => Promise<unknown>;

/**
 * Opening a desktop window should be acknowledged quickly. This prevents the
 * settings workspace from staying disabled when native window creation stalls.
 */
export async function invokeCredentialPanel(
  invoke: CredentialPanelInvoker,
  timeoutMs = CREDENTIAL_PANEL_OPEN_TIMEOUT_MS
): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      invoke().then(() => undefined),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("CREDENTIAL_PANEL_OPEN_TIMEOUT")), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
