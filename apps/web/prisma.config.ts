import path from "node:path";
import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Load .env.local for Prisma CLI commands (migrate, seed, studio)
config({ path: path.resolve(process.cwd(), ".env.local") });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
    directUrl: env("DIRECT_URL"),
  },
});
