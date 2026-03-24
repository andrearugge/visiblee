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
from .competitor_pipeline import run_competitor_pipeline
from .discovery import discover_content
from .email import send_preview_report
from .fetcher import fetch_url
from .full_pipeline import run_full_pipeline
from .pipeline import run_preview_pipeline
from .segmenter import segment_html

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
            WHERE type IN ('preview_analysis', 'full_analysis', 'discovery', 'fetch_content', 'competitor_analysis')
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
                WHERE type IN ('preview_analysis', 'send_preview_report', 'discovery', 'fetch_content', 'full_analysis', 'competitor_analysis')
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
                "citationPowerScore" = %(citation_power_score)s,
                "extractabilityScore" = %(extractability_score)s,
                "entityAuthorityScore" = %(entity_authority_score)s,
                "sourceAuthorityScore" = %(source_authority_score)s,
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
                       "aiReadinessScore", "fanoutCoverageScore", "citationPowerScore",
                       "extractabilityScore", "entityAuthorityScore", "sourceAuthorityScore",
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
            citation_power_score=float(preview["citationPowerScore"] or 0),
            extractability_score=float(preview["extractabilityScore"] or 0),
            entity_authority_score=float(preview["entityAuthorityScore"] or 0),
            source_authority_score=float(preview["sourceAuthorityScore"] or 0),
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


async def process_fetch_content_job(job: dict) -> None:
    """Fetch a single content URL, segment into passages, persist to DB."""
    job_id = job["id"]
    payload = job.get("payload") or {}
    content_id = payload.get("contentId") if isinstance(payload, dict) else None

    if not content_id:
        conn = get_conn()
        try:
            fail_job(conn, job_id, "Missing contentId in fetch_content job payload")
        finally:
            conn.close()
        return

    log.info(f"Fetching content {content_id} (job {job_id})")
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT id, url, title FROM contents WHERE id = %s',
                (content_id,),
            )
            content = cur.fetchone()

        if not content:
            fail_job(conn, job_id, "Content record not found")
            return

        fetched = await asyncio.wait_for(fetch_url(content["url"]), timeout=20)

        if not fetched:
            # Mark as failed but don't fail the job permanently
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE contents
                    SET "lastFetchedAt" = NOW(), "updatedAt" = NOW()
                    WHERE id = %s
                    """,
                    (content_id,),
                )
            conn.commit()
            complete_job(conn, job_id)
            log.warning(f"Fetch {content['url']}: no content returned")
            return

        # Segment HTML into passages
        passages = segment_html(fetched["html"])

        # Update content record
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE contents SET
                    title = COALESCE(title, %s),
                    "rawText" = %s,
                    "wordCount" = %s,
                    "lastFetchedAt" = NOW(),
                    "updatedAt" = NOW()
                WHERE id = %s
                """,
                (
                    fetched["title"],
                    fetched["raw_text"],
                    fetched["word_count"],
                    content_id,
                ),
            )

            # Insert passages (delete old ones first for idempotency)
            cur.execute('DELETE FROM passages WHERE "contentId" = %s', (content_id,))
            for p in passages:
                cur.execute(
                    """
                    INSERT INTO passages (
                        id, "contentId", "passageText", "passageIndex",
                        "wordCount", heading, "createdAt"
                    )
                    VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, NOW())
                    """,
                    (
                        content_id,
                        p["passageText"],
                        p["passageIndex"],
                        p["wordCount"],
                        p["heading"],
                    ),
                )
        conn.commit()

        complete_job(conn, job_id)
        log.info(
            f"Fetched {content['url']}: {fetched['word_count']} words, "
            f"{len(passages)} passages (job {job_id})"
        )

    except asyncio.TimeoutError:
        log.warning(f"Fetch job {job_id} timed out for {content_id}")
        try:
            complete_job(conn, job_id)  # don't retry on timeout
        except Exception:
            pass
    except Exception as e:
        log.error(f"Fetch job {job_id} failed: {e}", exc_info=True)
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
                'SELECT "websiteUrl", "brandName", "targetLanguage", "targetCountry" FROM projects WHERE id = %s',
                (project_id,),
            )
            project = cur.fetchone()

        if not project:
            fail_job(conn, job_id, "Project not found")
            return

        language = project.get("targetLanguage") or "en"
        target_country = project.get("targetCountry") or "US"

        # Load active target queries to enable sector-keyword and Gemini Grounding discovery
        with conn.cursor() as cur:
            cur.execute(
                'SELECT "queryText" FROM target_queries WHERE "projectId" = %s AND "isActive" = true',
                (project_id,),
            )
            target_queries = [row["queryText"] for row in cur.fetchall()]

        results = await asyncio.wait_for(
            discover_content(
                website_url=project["websiteUrl"],
                brand_name=project["brandName"],
                language=language,
                country=target_country,
                target_queries=target_queries or None,
            ),
            timeout=120,
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


def _create_notification(conn, user_id: str, project_id: str, notif_type: str, title: str, message: str | None = None) -> None:
    """Insert a notification for the user."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO notifications (id, "userId", "projectId", type, title, message, "isRead", "createdAt")
            VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, false, NOW())
            """,
            (user_id, project_id, notif_type, title[:200], message),
        )
    conn.commit()


def _get_project_user(conn, project_id: str) -> tuple[str | None, str | None, str]:
    """Return (userId, brandName, preferredLocale) for a project."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT p."userId", p."brandName", u."preferredLocale"
            FROM projects p
            JOIN users u ON u.id = p."userId"
            WHERE p.id = %s
            """,
            (project_id,),
        )
        row = cur.fetchone()
    if not row:
        return None, None, "en"
    return row["userId"], row["brandName"], row["preferredLocale"] or "en"


def _get_previous_ai_score(conn, project_id: str) -> float | None:
    """Return the second-latest aiReadinessScore for a project (the one before the current)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT "aiReadinessScore" FROM project_score_snapshots
            WHERE "projectId" = %s
            ORDER BY "createdAt" DESC
            OFFSET 1 LIMIT 1
            """,
            (project_id,),
        )
        row = cur.fetchone()
    return float(row["aiReadinessScore"]) if row else None


async def process_full_analysis_job(job: dict) -> None:
    """Run the full scoring pipeline for a project."""
    job_id = job["id"]
    project_id = job.get("projectId")

    if not project_id:
        conn = get_conn()
        try:
            fail_job(conn, job_id, "Missing projectId in full_analysis job")
        finally:
            conn.close()
        return

    log.info(f"Running full analysis for project {project_id} (job {job_id})")
    conn = get_conn()
    result = None
    try:
        result = await asyncio.wait_for(
            run_full_pipeline(conn, project_id),
            timeout=300,
        )
        complete_job(conn, job_id)
        log.info(f"Full analysis job {job_id} completed for project {project_id}")
    except asyncio.TimeoutError:
        log.error(f"Full analysis job {job_id} timed out after 300s")
        try:
            fail_job(conn, job_id, "Full analysis timed out after 300s")
        except Exception:
            pass
    except Exception as e:
        log.error(f"Full analysis job {job_id} failed: {e}", exc_info=True)
        try:
            fail_job(conn, job_id, str(e)[:500])
        except Exception:
            pass
    finally:
        conn.close()

    # Create notifications (separate connection, non-critical — never fails the job)
    if result is not None:
        notif_conn = get_conn()
        try:
            user_id, brand_name, locale = _get_project_user(notif_conn, project_id)
            if user_id:
                new_score = result["scores"].get("ai_readiness_score", 0)
                prev_score = _get_previous_ai_score(notif_conn, project_id)
                score_str = f"{round(new_score * 100)}/100"
                project_label = brand_name or ("il tuo progetto" if locale == "it" else "your project")

                if locale == "it":
                    complete_title = f"Analisi completata — {project_label}"
                    complete_msg = f"AI Readiness Score: {score_str}"
                else:
                    complete_title = f"Analysis complete — {project_label}"
                    complete_msg = f"AI Readiness Score: {score_str}"

                _create_notification(
                    notif_conn, user_id, project_id,
                    "analysis_complete",
                    complete_title,
                    complete_msg,
                )
                log.info(f"[{project_id}] Notification created for user {user_id}")

                # Notify score change if delta > 5 pts
                if prev_score is not None:
                    delta = round((new_score - prev_score) * 100)
                    if abs(delta) >= 5:
                        prev_score_str = f"{round(prev_score * 100)}/100"
                        if locale == "it":
                            direction = "migliorato" if delta > 0 else "diminuito"
                            change_title = f"Punteggio {direction} di {abs(delta)} pt — {project_label}"
                            change_msg = f"Nuovo punteggio: {score_str} (era {prev_score_str})"
                        else:
                            direction = "improved" if delta > 0 else "dropped"
                            change_title = f"Score {direction} by {abs(delta)} pts — {project_label}"
                            change_msg = f"New score: {score_str} (was {prev_score_str})"
                        _create_notification(
                            notif_conn, user_id, project_id,
                            "score_change",
                            change_title,
                            change_msg,
                        )
        except Exception as e:
            log.warning(f"[{project_id}] Failed to create notification: {e}", exc_info=True)
        finally:
            notif_conn.close()


async def process_competitor_analysis_job(job: dict) -> None:
    """Run the competitor crawl + scoring pipeline."""
    job_id = job["id"]
    project_id = job.get("projectId")
    payload = job.get("payload") or {}
    competitor_id = payload.get("competitorId") if isinstance(payload, dict) else None

    if not competitor_id:
        conn = get_conn()
        try:
            fail_job(conn, job_id, "Missing competitorId in competitor_analysis job payload")
        finally:
            conn.close()
        return

    log.info(f"Running competitor analysis for {competitor_id} (job {job_id})")
    conn = get_conn()
    try:
        await asyncio.wait_for(
            run_competitor_pipeline(conn, project_id, competitor_id),
            timeout=120,
        )
        complete_job(conn, job_id)
        log.info(f"Competitor analysis job {job_id} completed")
    except asyncio.TimeoutError:
        log.error(f"Competitor analysis job {job_id} timed out")
        try:
            fail_job(conn, job_id, "Competitor analysis timed out after 120s")
        except Exception:
            pass
    except Exception as e:
        log.error(f"Competitor analysis job {job_id} failed: {e}", exc_info=True)
        try:
            fail_job(conn, job_id, str(e)[:500])
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
            elif job_type == "fetch_content":
                await process_fetch_content_job(job)
            elif job_type == "full_analysis":
                await process_full_analysis_job(job)
            elif job_type == "competitor_analysis":
                await process_competitor_analysis_job(job)
            else:
                await process_job(job)
        else:
            await asyncio.sleep(config.WORKER_POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(run_worker())
