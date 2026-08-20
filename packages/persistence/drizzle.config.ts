import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./packages/persistence/src/schema.ts",
  out: "./packages/persistence/drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://searchos:searchos@localhost:5432/searchos"
  },
  strict: true,
  verbose: true
});
