import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readLocalePreference, saveLocalePreference } from "./locale-preference";

const originalPreferencePath = process.env.SEARCHOS_APP_PREFERENCES_PATH;
const temporaryFolders: string[] = [];

afterEach(() => {
  if (originalPreferencePath === undefined) delete process.env.SEARCHOS_APP_PREFERENCES_PATH;
  else process.env.SEARCHOS_APP_PREFERENCES_PATH = originalPreferencePath;
  for (const folder of temporaryFolders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

function useTemporaryPreferenceFile(): string {
  const folder = mkdtempSync(path.join(os.tmpdir(), "searchos-locale-"));
  temporaryFolders.push(folder);
  const file = path.join(folder, "preferences.json");
  process.env.SEARCHOS_APP_PREFERENCES_PATH = file;
  return file;
}

describe("local locale preference", () => {
  it("writes and reads only the public locale preference", () => {
    const file = useTemporaryPreferenceFile();
    const saved = saveLocalePreference("en-US");

    expect(saved.locale).toBe("en-US");
    expect(readLocalePreference()).toMatchObject({ locale: "en-US" });
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ locale: "en-US", updatedAt: expect.any(String) });
  });

  it("fails closed for malformed or unsupported JSON", () => {
    const file = useTemporaryPreferenceFile();
    writeFileSync(file, "{not-valid-json", "utf8");
    expect(readLocalePreference()).toBeNull();

    writeFileSync(file, JSON.stringify({ locale: "fr-FR", apiKey: "must-not-be-used" }), "utf8");
    expect(readLocalePreference()).toBeNull();
  });
});
