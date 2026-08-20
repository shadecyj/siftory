import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defaultLocale, isLocale, type Locale } from "../i18n/locale";

export interface PersistedLocalePreference {
  readonly locale: Locale;
  readonly updatedAt: string;
}

function workspaceRoot(): string {
  return [process.cwd(), path.resolve(process.cwd(), "..", "..")]
    .find((candidate) => existsSync(path.join(candidate, "packages", "persistence", "drizzle"))) ?? process.cwd();
}

function preferenceFilePath(): string {
  const configured = process.env.SEARCHOS_APP_PREFERENCES_PATH?.trim();
  if (configured) return path.resolve(configured);
  const configuredDataDir = process.env.SEARCHOS_PGLITE_DATA_DIR?.trim();
  const dataDir = configuredDataDir
    ? path.isAbsolute(configuredDataDir) ? configuredDataDir : path.join(/* turbopackIgnore: true */ workspaceRoot(), configuredDataDir)
    : path.join(workspaceRoot(), ".searchos", "runtime-db");
  return path.join(path.dirname(dataDir), "preferences.json");
}

export function readLocalePreference(): PersistedLocalePreference | null {
  try {
    const file = preferenceFilePath();
    if (!existsSync(/* turbopackIgnore: true */ file)) return null;
    const candidate: unknown = JSON.parse(readFileSync(/* turbopackIgnore: true */ file, "utf8"));
    if (!candidate || typeof candidate !== "object") return null;
    const record = candidate as { locale?: unknown; updatedAt?: unknown };
    if (!isLocale(record.locale) || typeof record.updatedAt !== "string") return null;
    return { locale: record.locale, updatedAt: record.updatedAt };
  } catch {
    return null;
  }
}

export function saveLocalePreference(locale: Locale): PersistedLocalePreference {
  const preference: PersistedLocalePreference = { locale: isLocale(locale) ? locale : defaultLocale, updatedAt: new Date().toISOString() };
  const file = preferenceFilePath();
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  writeFileSync(temporary, JSON.stringify(preference), { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, file);
  return preference;
}
