"""
Scheduler — periodic job creator for Visiblee Analyzer.

Run this script via cron (Ploi) to create scheduled jobs for all active projects.
It must exit after each run; the OS scheduler handles the cadence.

Usage:
    python -m app.scheduler

Ploi cron configuration (see docs/staging-setup.md):
    Command : cd /var/www/analyzer && .venv/bin/python -m app.scheduler
    Schedule: * * * * *  (every minute — the script decides internally what to create)

What runs when:
    Every day    → create_daily_citation_jobs   (scheduled_citation_daily)
    Every Sunday → create_weekly_gsc_sync_jobs  (scheduled_gsc_sync)
    Day 1/month  → create_monthly_analysis_jobs (scheduled_analysis)

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


def _pending_job_exists(conn, job_type: str, project_id: str, since: datetime) -> bool:
    """Return True if a pending/running job of the given type exists for the project since `since`."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id FROM jobs
            WHERE type = %(type)s
              AND "projectId" = %(project_id)s
              AND status IN ('pending', 'running')
              AND "createdAt" >= %(since)s
            LIMIT 1
            """,
            {"type": job_type, "project_id": project_id, "since": since},
        )
        return cur.fetchone() is not None


_SCHEDULER_JOB_CHANNEL: dict[str, str] = {
    "scheduled_citation_daily":  "fast",
    "scheduled_citation_burst":  "fast",
    "scheduled_gsc_sync":        "default",
    "scheduled_analysis":        "heavy",
    "cleanup_citation_checks":   "default",
    "cleanup_old_data":          "default",
}


def _create_job(conn, job_type: str, project_id: str, payload: dict | None = None) -> str:
    job_id = str(uuid.uuid4())
    job_channel = _SCHEDULER_JOB_CHANNEL.get(job_type, "default")
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO jobs (id, "projectId", type, status, payload, "jobChannel", "createdAt")
            VALUES (%(id)s, %(project_id)s, %(type)s, 'pending', %(payload)s, %(job_channel)s, NOW())
            """,
            {
                "id": job_id,
                "project_id": project_id,
                "type": job_type,
                "payload": json.dumps(payload) if payload is not None else None,
                "job_channel": job_channel,
            },
        )
    conn.commit()
    return job_id


# ─── Daily: citation checks ──────────────────────────────────────────────────

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
        cur.execute(
            """
            SELECT
                p.id           AS project_id,
                u.role         AS user_role,
                tq.id          AS query_id,
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
        limit = _daily_limit(project_roles[project_id])

        for query in queries[:limit]:
            query_id = query["id"]

            with conn.cursor() as cur:
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
                    {"project_id": project_id, "query_id": query_id, "today_start": today_start},
                )
                if cur.fetchone():
                    log.debug("Skip daily — job exists project=%s query=%s", project_id, query_id)
                    continue

            job_id = _create_job(conn, "scheduled_citation_daily", project_id, {"targetQueryId": query_id})
            log.info("Created scheduled_citation_daily job=%s project=%s query=%s", job_id, project_id, query_id)
            created += 1

    return created


# ─── Weekly (Sunday): GSC sync ───────────────────────────────────────────────

def create_weekly_gsc_sync_jobs(conn) -> int:
    """
    Every Sunday: create a `scheduled_gsc_sync` job for each project that has
    an active GSC connection. Skips if a pending/running job already exists
    this week (guards against duplicate cron runs).

    Returns the number of jobs created.
    """
    today = _today_utc()
    # Only run on Sunday (weekday() == 6)
    if today.weekday() != 6:
        return 0

    week_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
    created = 0

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT p.id AS project_id
            FROM projects p
            JOIN gsc_connections gc ON gc."projectId" = p.id
            WHERE p.status = 'active'
              AND gc.status = 'active'
              AND gc."propertyUrl" IS NOT NULL
            ORDER BY p.id
            """
        )
        rows = cur.fetchall()

    for row in rows:
        project_id = row["project_id"]

        if _pending_job_exists(conn, "scheduled_gsc_sync", project_id, week_start):
            log.debug("Skip gsc_sync — job exists project=%s", project_id)
            continue

        job_id = _create_job(conn, "scheduled_gsc_sync", project_id)
        log.info("Created scheduled_gsc_sync job=%s project=%s", job_id, project_id)
        created += 1

    return created


# ─── Monthly (day 1): full analysis ─────────────────────────────────────────

def create_monthly_analysis_jobs(conn) -> int:
    """
    On the 1st of each month: create a `scheduled_analysis` job for every
    active project. Skips if a pending/running job already exists this month.

    Returns the number of jobs created.
    """
    today = _today_utc()
    if today.day != 1:
        return 0

    month_start = datetime(today.year, today.month, 1, tzinfo=timezone.utc)
    created = 0

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id AS project_id FROM projects
            WHERE status = 'active'
            ORDER BY id
            """
        )
        rows = cur.fetchall()

    for row in rows:
        project_id = row["project_id"]

        if _pending_job_exists(conn, "scheduled_analysis", project_id, month_start):
            log.debug("Skip monthly analysis — job exists project=%s", project_id)
            continue

        job_id = _create_job(conn, "scheduled_analysis", project_id)
        log.info("Created scheduled_analysis job=%s project=%s", job_id, project_id)
        created += 1

    return created


# ─── Monthly (day 1): data cleanup ──────────────────────────────────────────

def create_monthly_cleanup_job(conn) -> int:
    """
    On the 1st of each month: create a `cleanup_old_data` job.
    Cleans up stale fanout queries/coverage maps (>4 weeks) and trims rawHtml (>90 days).

    Returns the number of jobs created (0 or 1).
    """
    today = _today_utc()
    if today.day != 1:
        return 0

    month_start = datetime(today.year, today.month, 1, tzinfo=timezone.utc)

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id FROM jobs
            WHERE type = 'cleanup_old_data'
              AND status IN ('pending', 'running', 'completed')
              AND "createdAt" >= %(month_start)s
            LIMIT 1
            """,
            {"month_start": month_start},
        )
        if cur.fetchone():
            log.debug("Skip cleanup_old_data — job already exists this month")
            return 0

    # cleanup_old_data has no projectId — pass None
    job_id = str(__import__("uuid").uuid4())
    job_channel = _SCHEDULER_JOB_CHANNEL.get("cleanup_old_data", "default")
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO jobs (id, "projectId", type, status, payload, "jobChannel", "createdAt")
            VALUES (%(id)s, NULL, 'cleanup_old_data', 'pending', NULL, %(job_channel)s, NOW())
            """,
            {"id": job_id, "job_channel": job_channel},
        )
    conn.commit()
    log.info("Created cleanup_old_data job=%s", job_id)
    return 1


# ─── Entry point ────────────────────────────────────────────────────────────

def run() -> None:
    log.info("Scheduler run — connecting to DB...")
    conn = get_conn()
    try:
        daily = create_daily_citation_jobs(conn)
        weekly = create_weekly_gsc_sync_jobs(conn)
        monthly = create_monthly_analysis_jobs(conn)
        cleanup = create_monthly_cleanup_job(conn)
        log.info(
            "Scheduler run complete — daily=%d weekly=%d monthly=%d cleanup=%d",
            daily, weekly, monthly, cleanup,
        )
    finally:
        conn.close()


if __name__ == "__main__":
    run()
