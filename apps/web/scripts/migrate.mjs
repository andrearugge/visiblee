/**
 * Migration wrapper for Neon + Vercel.
 *
 * Neon computes can be in autosuspend; the first query wakes them up but
 * pg_advisory_lock (used internally by Prisma migrate) may still time out
 * if the compute needs a moment to be fully ready.
 *
 * Strategy: warm up with a lightweight query, then retry migrate deploy.
 */

import { execSync } from "child_process";
import pg from "pg";

const { Client } = pg;

const DIRECT_URL = process.env.DIRECT_URL;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 8_000;

if (!DIRECT_URL) {
  console.error("DIRECT_URL env var is not set");
  process.exit(1);
}

// Warm up: ensure the Neon compute is awake before Prisma tries the advisory lock.
try {
  const client = new Client({ connectionString: DIRECT_URL, connectionTimeoutMillis: 20_000 });
  await client.connect();
  await client.query("SELECT 1");
  await client.end();
  console.log("DB warmed up.");
} catch (err) {
  console.warn("Warmup failed (non-fatal):", err.message);
}

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    console.log(`prisma migrate deploy — attempt ${attempt}/${MAX_RETRIES}`);
    execSync("prisma migrate deploy", { stdio: "inherit" });
    process.exit(0);
  } catch {
    if (attempt < MAX_RETRIES) {
      console.warn(`Failed, retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    } else {
      console.error("Migration failed after all retries.");
      process.exit(1);
    }
  }
}
