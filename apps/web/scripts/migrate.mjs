/**
 * Migration wrapper for Neon + Vercel.
 *
 * Neon serverless computes can be suspended; pg_advisory_lock (used by Prisma
 * migrate) may time out while the compute is waking up, or if a stale lock
 * remains from a previous failed deployment.
 *
 * Strategy:
 * 1. Warm up the DB with a lightweight query so the compute is fully awake.
 * 2. Release any stale Prisma advisory lock (key 72707369) held by dead sessions.
 * 3. Run `prisma migrate deploy` with up to MAX_RETRIES attempts.
 */

import { execSync } from "child_process";
import pg from "pg";

const { Pool } = pg;

const DIRECT_URL = process.env.DIRECT_URL;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10_000;
// Advisory lock key used by Prisma migrate
const PRISMA_LOCK_KEY = 72707369n;

if (!DIRECT_URL) {
  console.error("DIRECT_URL env var is not set");
  process.exit(1);
}

async function warmupAndUnlock() {
  const pool = new Pool({ connectionString: DIRECT_URL, connectionTimeoutMillis: 30_000 });
  try {
    const client = await pool.connect();
    // Warm up
    await client.query("SELECT 1");
    // Release stale Prisma lock held by any terminated session
    await client.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_locks l
       JOIN pg_stat_activity a ON l.pid = a.pid
       WHERE l.locktype = 'advisory'
         AND l.classid = $1
         AND a.state = 'idle'`,
      [Number(PRISMA_LOCK_KEY >> 32n)]
    );
    client.release();
    console.log("DB warmed up and stale locks released.");
  } catch (err) {
    // Non-fatal: log and continue — superuser perms may not be available
    console.warn("Warmup/unlock step failed (non-fatal):", err.message);
  } finally {
    await pool.end();
  }
}

await warmupAndUnlock();

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    console.log(`Running prisma migrate deploy (attempt ${attempt}/${MAX_RETRIES})...`);
    execSync("prisma migrate deploy", { stdio: "inherit" });
    console.log("Migration succeeded.");
    process.exit(0);
  } catch {
    if (attempt < MAX_RETRIES) {
      console.warn(`Migration failed, retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    } else {
      console.error("Migration failed after all retries.");
      process.exit(1);
    }
  }
}
