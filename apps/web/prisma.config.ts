import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local for Prisma CLI commands (migrate, seed, studio)
config({ path: path.resolve(process.cwd(), ".env.local") });

// DIRECT_URL = non-pooler connection required for migrations (advisory lock on Neon).
// Falls back to DATABASE_URL in environments that don't run migrations (e.g. Railway worker).
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: migrationUrl,
  },
});
