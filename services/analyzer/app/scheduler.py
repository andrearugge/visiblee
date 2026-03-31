"""
Scheduler — periodic job creator for Visiblee Analyzer.

Run this script via cron (Ploi) to create scheduled jobs for all active projects.
It must exit after each run; the OS scheduler handles the cadence.

Usage:
    python -m app.scheduler

Ploi cron configuration (see docs/staging-setup.md):
    Command : cd /var/www/analyzer && .venv/bin/python -m app.scheduler
    Schedule: * * * * *  (every minute — the script decides internally what to create)

Plan limits (no billing model yet — role is used as proxy):
    free  (role = 'user')                  → 3 queries/day scheduled
    pro   (role = 'admin' | 'superadmin')  → 10 queries/day scheduled
"""

from __future__ import annotations

import json
import logging
import uuid
import warnings
from datetime import date, datetime, timezone

warnings.filterwarnings("ignore", category=DeprecationWarning, module="urllib3")
warnings.filterwarnings("ignore", message=".*NotOpenSSLWarning.*")
warnings.filterwarnings("ignore", message=".*end of life.*", category=FutureWarning)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

import psycopg2
import psycopg2.extras

from .config import config

# ─── Plan limits ────────────────────────────────────────────────────────────

FREE_DAILY_LIMIT = 3
PRO_DAILY_LIMIT = 10
PRO_ROLES = {"admin", "superadmin"}


def get_conn() -> psycopg2.extensions.connection:
    return psycopg2.connect(config.DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


# ─── Helpers ────────────────────────────────────────────────────────────────

def _daily_limit(role: str) -> int:
    return PRO_DAILY_LIMIT if role in PRO_ROLES else FREE_DAILY_LIMIT


def _today_utc() -> date:
    return datetime.now(timezone.utc).date()


# ─── Core logic ─────────────────────────────────────────────────────────────

def create_daily_citation_jobs(conn) -> int:
    """
    For every active project, create one `scheduled_citation_daily` job per
    active target query (up to the plan limit), but only if no pending job
    already exists for that query today.

    Returns the number of jobs created.
    """
    today = _today_utc()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
    created = 0

    with conn.cursor() as cur:
        # Fetch active projects with owner role and active queries
        cur.execute(
            """
            SELECT
                p.id          AS project_id,
                u.role        AS user_role,
                tq.id         AS query_id,
                tq."queryText" AS query_text
            FROM projects p
            JOIN users u ON u.id = p."userId"
            JOIN target_queries tq ON tq."projectId" = p.id
            WHERE p.status = 'active'
              AND tq."isActive" = true
            ORDER BY p.id, tq."createdAt"
            """
        )
        rows = cur.fetchall()

    # Group queries by project, respecting plan limit
    projects: dict[str, list[dict]] = {}
    project_roles: dict[str, str] = {}
    for row in rows:
        pid = row["project_id"]
        if pid not in projects:
            projects[pid] = []
            project_roles[pid] = row["user_role"]
        projects[pid].append({"id": row["query_id"], "text": row["query_text"]})

    for project_id, queries in projects.items():
        role = project_roles[project_id]
        limit = _daily_limit(role)
        queries_to_schedule = queries[:limit]

        for query in queries_to_schedule:
            query_id = query["id"]

            with conn.cursor() as cur:
                # Check for an existing pending/running job for this query today
                cur.execute(
                    """
                    SELECT id FROM jobs
                    WHERE type = 'scheduled_citation_daily'
                      AND "projectId" = %(project_id)s
                      AND status IN ('pending', 'running')
                      AND payload->>'targetQueryId' = %(query_id)s
                      AND "createdAt" >= %(today_start)s
                    LIMIT 1
                    """,
                    {
                        "project_id": project_id,
                        "query_id": query_id,
                        "today_start": today_start,
                    },
                )
                existing = cur.fetchone()

            if existing:
                log.debug(
                    "Skip — job already exists for project=%s query=%s",
                    project_id,
                    query_id,
                )
                continue

            # Create the job
            job_id = str(uuid.uuid4())
            payload = json.dumps({"targetQueryId": query_id})

            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO jobs (id, "projectId", type, status, payload, "createdAt")
                    VALUES (%(id)s, %(project_id)s, 'scheduled_citation_daily', 'pending', %(payload)s, NOW())
                    """,
                    {"id": job_id, "project_id": project_id, "payload": payload},
                )
            conn.commit()

            log.info(
                "Created scheduled_citation_daily job=%s project=%s query=%s",
                job_id,
                project_id,
                query_id,
            )
            created += 1

    return created


# ─── Entry point ────────────────────────────────────────────────────────────

def run() -> None:
    log.info("Scheduler run — connecting to DB...")
    conn = get_conn()
    try:
        created = create_daily_citation_jobs(conn)
        log.info("Scheduler run complete — %d job(s) created.", created)
    finally:
        conn.close()


if __name__ == "__main__":
    run()
