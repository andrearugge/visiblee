from __future__ import annotations

"""
Job worker — polls the jobs table for preview_analysis jobs and processes them.
"""

import asyncio
import json
import logging
import warnings
from datetime import datetime, timezone

# Suppress known harmless warnings on macOS with Python 3.9 / LibreSSL
warnings.filterwarnings("ignore", category=DeprecationWarning, module="urllib3")
warnings.filterwarnings("ignore", message=".*NotOpenSSLWarning.*")
warnings.filterwarnings("ignore", message=".*end of life.*", category=FutureWarning)

import psycopg2
import psycopg2.extras

from .config import config
from .discovery import discover_content
from .email import send_preview_report
from .pipeline import run_preview_pipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# Pipeline timeout: abort if analysis takes longer than this (seconds)
PIPELINE_TIMEOUT = 120


def get_conn() -> psycopg2.extensions.connection:
    return psycopg2.connect(config.DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def recover_stale_jobs(conn) -> int:
    """
    Reset jobs stuck in 'running' state for longer than PIPELINE_TIMEOUT.
    This handles the case where the worker was killed mid-job (e.g. uvicorn --reload).
    Returns the number of jobs reset.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE jobs
            SET status = 'pending',
                "startedAt" = NULL,
                error = 'Recovered from stale running state'
            WHERE type = 'preview_analysis'
              AND status = 'running'
              AND "startedAt" < NOW() - INTERVAL '%s seconds'
              AND attempts < "maxAttempts"
            """,
            (PIPELINE_TIMEOUT,),
        )
        count = cur.rowcount
        if count:
            # Also reset the corresponding previews back to pending
            cur.execute(
                """
                UPDATE preview_analyses SET status = 'pending'
                WHERE id IN (
                    SELECT "previewId" FROM jobs
                    WHERE type = 'preview_analysis'
                      AND status = 'pending'
                      AND error = 'Recovered from stale running state'
                )
                """,
            )
        conn.commit()
    return count


def claim_job(conn) -> dict | None:
    """Atomically claim the next pending job of any handled type."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE jobs
            SET status = 'running',
                "startedAt" = NOW(),
                attempts = attempts + 1
            WHERE id = (
                SELECT id FROM jobs
                WHERE type IN ('preview_analysis', 'send_preview_report', 'discovery', 'full_analysis')
                  AND status = 'pending'
                  AND attempts < "maxAttempts"
                ORDER BY "createdAt"
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING id, type, "previewId", "projectId", payload
            """,
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row) if row else None


def update_preview(conn, preview_id: str, result: dict) -> None:
    """Write analysis results to preview_analyses."""
    scores = result["scores"]
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE preview_analyses SET
                status = 'completed',
                "aiReadinessScore" = %(ai_readiness_score)s,
                "fanoutCoverageScore" = %(fanout_coverage_score)s,
                "passageQualityScore" = %(passage_quality_score)s,
                "chunkabilityScore" = %(chunkability_score)s,
                "entityCoherenceScore" = %(entity_coherence_score)s,
                "crossPlatformScore" = %(cross_platform_score)s,
                insights = %(insights)s,
                "contentsFound" = %(contents_found)s,
                "analysisData" = %(analysis_data)s
            WHERE id = %(id)s
            """,
            {
                **scores,
                "insights": json.dumps(result["insights"]),
                "contents_found": result["contents_found"],
                "analysis_data": json.dumps(result["analysis_data"]),
                "id": preview_id,
            },
        )
        conn.commit()


def fail_job(conn, job_id: str, error: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE jobs SET status = 'failed', error = %s, "completedAt" = NOW()
            WHERE id = %s
            """,
            (error[:500], job_id),
        )
        cur.execute(
            "UPDATE preview_analyses SET status = 'failed' WHERE id = "
            "(SELECT \"previewId\" FROM jobs WHERE id = %s)",
            (job_id,),
        )
        conn.commit()


def complete_job(conn, job_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE jobs SET status = \'completed\', "completedAt" = NOW() WHERE id = %s',
            (job_id,),
        )
        conn.commit()


async def process_job(job: dict) -> None:
    """Run the pipeline for one job, with a hard timeout."""
    job_id = job["id"]
    preview_id = job["previewId"]
    log.info(f"Processing job {job_id} for preview {preview_id}")

    conn = get_conn()
    try:
        # Fetch preview data
        with conn.cursor() as cur:
            cur.execute(
                'SELECT "websiteUrl", "brandName", "queryTargets", locale FROM preview_analyses WHERE id = %s',
                (preview_id,),
            )
            preview = cur.fetchone()

        if not preview:
            fail_job(conn, job_id, "Preview not found")
            return

        # Mark preview as processing
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE preview_analyses SET status = 'processing' WHERE id = %s",
                (preview_id,),
            )
            conn.commit()

        result = await asyncio.wait_for(
            run_preview_pipeline(
                website_url=preview["websiteUrl"],
                brand_name=preview["brandName"],
                query_targets=list(preview["queryTargets"]),
                language=preview["locale"] or "en",
            ),
            timeout=PIPELINE_TIMEOUT,
        )

        update_preview(conn, preview_id, result)
        complete_job(conn, job_id)
        log.info(f"Job {job_id} completed. AI Readiness: {result['scores']['ai_readiness_score']:.0%}")

    except asyncio.TimeoutError:
        log.error(f"Job {job_id} timed out after {PIPELINE_TIMEOUT}s")
        try:
            fail_job(conn, job_id, f"Pipeline timed out after {PIPELINE_TIMEOUT}s")
        except Exception:
            pass
    except Exception as e:
        log.error(f"Job {job_id} failed: {e}", exc_info=True)
        try:
            fail_job(conn, job_id, str(e))
        except Exception:
            pass
    finally:
        conn.close()


async def process_email_job(job: dict) -> None:
    """Send a preview report email."""
    job_id = job["id"]
    preview_id = job["previewId"]
    payload = job.get("payload") or {}
    to_email = payload.get("email") if isinstance(payload, dict) else None

    if not to_email:
        conn = get_conn()
        try:
            fail_job(conn, job_id, "Missing email in job payload")
        finally:
            conn.close()
        return

    log.info(f"Sending report email for preview {preview_id} to {to_email}")
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT "brandName", "websiteUrl", locale,
                       "aiReadinessScore", "fanoutCoverageScore", "passageQualityScore",
                       "chunkabilityScore", "entityCoherenceScore", "crossPlatformScore",
                       insights
                FROM preview_analyses
                WHERE id = %s AND status = 'completed'
                """,
                (preview_id,),
            )
            preview = cur.fetchone()

        if not preview:
            fail_job(conn, job_id, "Preview not found or not completed")
            return

        import json as _json
        raw_insights = preview["insights"]
        insights: list[str] = (
            _json.loads(raw_insights) if isinstance(raw_insights, str) else (raw_insights or [])
        )

        send_preview_report(
            to_email=to_email,
            brand_name=preview["brandName"],
            website_url=preview["websiteUrl"],
            ai_readiness_score=float(preview["aiReadinessScore"] or 0),
            fanout_coverage_score=float(preview["fanoutCoverageScore"] or 0),
            passage_quality_score=float(preview["passageQualityScore"] or 0),
            chunkability_score=float(preview["chunkabilityScore"] or 0),
            entity_coherence_score=float(preview["entityCoherenceScore"] or 0),
            cross_platform_score=float(preview["crossPlatformScore"] or 0),
            insights=insights,
            preview_id=preview_id,
            language=preview["locale"] or "en",
        )

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE preview_analyses SET \"reportSentAt\" = NOW() WHERE id = %s",
                (preview_id,),
            )
            conn.commit()

        complete_job(conn, job_id)
        log.info(f"Report email sent for job {job_id}")

    except Exception as e:
        log.error(f"Email job {job_id} failed: {e}", exc_info=True)
        try:
            fail_job(conn, job_id, str(e))
        except Exception:
            pass
    finally:
        conn.close()


async def process_discovery_job(job: dict) -> None:
    """Run content discovery for a project and save results to the contents table."""
    job_id = job["id"]
    project_id = job.get("projectId")

    if not project_id:
        conn = get_conn()
        try:
            fail_job(conn, job_id, "Missing projectId in discovery job")
        finally:
            conn.close()
        return

    log.info(f"Running discovery for project {project_id} (job {job_id})")
    conn = get_conn()
    try:
        # Fetch project data
        with conn.cursor() as cur:
            cur.execute(
                'SELECT "websiteUrl", "brandName" FROM projects WHERE id = %s',
                (project_id,),
            )
            project = cur.fetchone()

        if not project:
            fail_job(conn, job_id, "Project not found")
            return

        # Get user locale for language-aware classification
        with conn.cursor() as cur:
            cur.execute(
                'SELECT "preferredLocale" FROM users WHERE id = (SELECT "userId" FROM projects WHERE id = %s)',
                (project_id,),
            )
            user = cur.fetchone()
        language = (user or {}).get("preferredLocale", "en")

        results = await asyncio.wait_for(
            discover_content(
                website_url=project["websiteUrl"],
                brand_name=project["brandName"],
                language=language,
            ),
            timeout=90,
        )

        # Upsert into contents table (skip duplicates by url + projectId)
        inserted = 0
        with conn.cursor() as cur:
            for r in results:
                cur.execute(
                    """
                    INSERT INTO contents (
                        id, "projectId", url, title, platform,
                        "contentType", source, "isIndexed", "isConfirmed",
                        "discoveryConfidence", "createdAt", "updatedAt"
                    )
                    VALUES (
                        gen_random_uuid(), %s, %s, %s, %s,
                        %s, 'discovery', true, false,
                        %s, NOW(), NOW()
                    )
                    ON CONFLICT (url, "projectId") DO NOTHING
                    """,
                    (
                        project_id,
                        r["url"],
                        r["title"] or None,
                        r["platform"],
                        r["contentType"],
                        r["confidence"],
                    ),
                )
                if cur.rowcount:
                    inserted += 1
        conn.commit()

        complete_job(conn, job_id)
        log.info(f"Discovery job {job_id} done: {inserted} new content items for project {project_id}")

    except asyncio.TimeoutError:
        log.error(f"Discovery job {job_id} timed out")
        try:
            fail_job(conn, job_id, "Discovery timed out after 90s")
        except Exception:
            pass
    except Exception as e:
        log.error(f"Discovery job {job_id} failed: {e}", exc_info=True)
        try:
            fail_job(conn, job_id, str(e))
        except Exception:
            pass
    finally:
        conn.close()


async def run_worker() -> None:
    """Main worker loop — polls for jobs."""
    log.info("Worker started. Polling for preview_analysis jobs...")

    # Recover any jobs left in 'running' state from a previous crashed worker
    conn = get_conn()
    try:
        recovered = recover_stale_jobs(conn)
        if recovered:
            log.info(f"Recovered {recovered} stale job(s) back to pending.")
    finally:
        conn.close()

    while True:
        conn = get_conn()
        try:
            job = claim_job(conn)
        finally:
            conn.close()

        if job:
            job_type = job["type"]
            if job_type == "send_preview_report":
                await process_email_job(job)
            elif job_type == "discovery":
                await process_discovery_job(job)
            elif job_type == "full_analysis":
                log.info(f"full_analysis job {job['id']} received — engine not yet implemented (Task 3.5)")
                conn = get_conn()
                try:
                    complete_job(conn, job["id"])
                finally:
                    conn.close()
            else:
                await process_job(job)
        else:
            await asyncio.sleep(config.WORKER_POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(run_worker())
