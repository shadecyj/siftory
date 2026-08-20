import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { openSearchOsDatabase, type SearchOsDatabaseConnection } from "@searchos/persistence";

const workspaceRoot = [process.cwd(), path.resolve(process.cwd(), "..", "..")]
  .find((candidate) => existsSync(path.join(candidate, "packages", "persistence", "drizzle"))) ?? process.cwd();

function resolveMigrationsFolder(): string {
  const configured = process.env.SEARCHOS_MIGRATIONS_DIR?.trim();
  if (!configured) return path.join(workspaceRoot, "packages", "persistence", "drizzle");

  const folder = path.resolve(configured);
  if (!existsSync(folder)) {
    throw new Error(`SEARCHOS_MIGRATIONS_DIR does not exist: ${folder}`);
  }
  return folder;
}

const migrationsFolder = resolveMigrationsFolder();

function localDataDir(): string {
  const configured = process.env.SEARCHOS_PGLITE_DATA_DIR?.trim() || ".searchos/runtime-db";
  return path.isAbsolute(configured) ? configured : path.join(/* turbopackIgnore: true */ workspaceRoot, configured);
}

declare global {
  var searchOsDatabasePromise: Promise<SearchOsDatabaseConnection> | undefined;
}

export function databaseConnection(): Promise<SearchOsDatabaseConnection> {
  globalThis.searchOsDatabasePromise ??= (() => {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (databaseUrl) return openSearchOsDatabase({ migrationsFolder, databaseUrl });

    const dataDir = localDataDir();
    mkdirSync(dataDir, { recursive: true });
    return openSearchOsDatabase({ migrationsFolder, dataDir });
  })();
  return globalThis.searchOsDatabasePromise;
}

export async function database() {
  return (await databaseConnection()).db;
}
