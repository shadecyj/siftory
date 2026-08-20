import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL.");
}

const client = new pg.Client({ connectionString });
await client.connect();
try {
  await migrate(drizzle(client), { migrationsFolder: "packages/persistence/drizzle" });
console.log("Siftory database migration completed.");
} finally {
  await client.end();
}
