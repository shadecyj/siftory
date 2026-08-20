import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { Pool } from "pg";
import type { SearchOsDatabase } from "./repository";
import * as schema from "./schema";

export interface OpenSearchOsDatabaseOptions {
  readonly migrationsFolder: string;
  readonly databaseUrl?: string;
  readonly dataDir?: string;
}

export interface SearchOsDatabaseConnection {
  readonly db: SearchOsDatabase;
  readonly driver: "postgres" | "pglite";
  close(): Promise<void>;
}

function pgliteUrl(dataDir: string): string {
  const normalized = dataDir.replace(/\\/g, "/");
  return normalized.startsWith("file://") ? normalized : `file://${normalized}`;
}

/** Opens PostgreSQL when configured, otherwise a durable local PGlite store. */
export async function openSearchOsDatabase(options: OpenSearchOsDatabaseOptions): Promise<SearchOsDatabaseConnection> {
  if (options.databaseUrl?.trim()) {
    const pool = new Pool({ connectionString: options.databaseUrl });
    const db = drizzleNodePg(pool, { schema });
    await migrateNodePg(db, { migrationsFolder: options.migrationsFolder });
    return {
      db: db as unknown as SearchOsDatabase,
      driver: "postgres",
      close: async () => { await pool.end(); }
    };
  }

  const client = options.dataDir ? new PGlite(pgliteUrl(options.dataDir)) : new PGlite();
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: options.migrationsFolder });
  return {
    db,
    driver: "pglite",
    close: async () => { await client.close(); }
  };
}
