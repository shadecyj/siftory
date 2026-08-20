import { describe, expect, it, vi } from "vitest";
import { invokeCredentialPanel } from "./credential-panel";

describe("invokeCredentialPanel", () => {
  it("resolves when the native launcher acknowledges the request", async () => {
    await expect(invokeCredentialPanel(async () => undefined, 20)).resolves.toBeUndefined();
  });

  it("returns control when the native launcher never acknowledges the request", async () => {
    vi.useFakeTimers();
    try {
      const pending = invokeCredentialPanel(() => new Promise(() => undefined), 5);
      const assertion = expect(pending).rejects.toThrow("CREDENTIAL_PANEL_OPEN_TIMEOUT");
      await vi.advanceTimersByTimeAsync(5);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
