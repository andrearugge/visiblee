from __future__ import annotations

"""
Job worker — polls the jobs table for preview_analysis jobs and processes them.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras

from .config import config
from .pipeline import run_preview_pipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


def get_conn() -> psycopg2.extensions.connection:
    return psycopg2.connect(config.DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def claim_job(conn) -> dict | None:
    """Atomically claim the next pending preview_analysis job."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE jobs
            SET status = 'running',
                "startedAt" = NOW(),
                attempts = attempts + 1
            WHERE id = (
                SELECT id FROM jobs
                WHERE type = 'preview_analysis'
                  AND status = 'pending'
                  AND attempts < "maxAttempts"
                ORDER BY "createdAt"
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING id, "previewId", payload
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
    """Run the pipeline for one job."""
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

        result = await run_preview_pipeline(
            website_url=preview["websiteUrl"],
            brand_name=preview["brandName"],
            query_targets=list(preview["queryTargets"]),
            language=preview["locale"] or "en",
        )

        update_preview(conn, preview_id, result)
        complete_job(conn, job_id)
        log.info(f"Job {job_id} completed. AI Readiness: {result['scores']['ai_readiness_score']:.0%}")

    except Exception as e:
        log.error(f"Job {job_id} failed: {e}")
        try:
            fail_job(conn, job_id, str(e))
        except Exception:
            pass
    finally:
        conn.close()


async def run_worker() -> None:
    """Main worker loop — polls for jobs."""
    log.info("Worker started. Polling for preview_analysis jobs...")
    while True:
        conn = get_conn()
        try:
            job = claim_job(conn)
        finally:
            conn.close()

        if job:
            await process_job(job)
        else:
            await asyncio.sleep(config.WORKER_POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(run_worker())
