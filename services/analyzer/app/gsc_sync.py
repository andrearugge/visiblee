from __future__ import annotations

"""
GSC Sync — pulls query data from Google Search Console API.

Flow:
  1. Load gsc_connection for project → decrypt refresh_token
  2. Refresh access_token if expired (or always to be safe)
  3. Call searchAnalytics.query with pagination
  4. Upsert rows into gsc_query_data
  5. Classify intent for every row
  6. Generate query suggestions
  7. Update gsc_connections.lastSyncAt
"""

import json
import logging
import uuid
from datetime import datetime, timezone

import httpx
import psycopg2.extensions

from .config import config
from .crypto_utils import decrypt
from .intent_engine import classify_intent, generate_intent_profiles, generate_query_suggestions

log = logging.getLogger(__name__)

_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GSC_BASE_URL = "https://www.googleapis.com/webmasters/v3"
_ROW_LIMIT = 5000


# ---------------------------------------------------------------------------
# Token management
# ---------------------------------------------------------------------------

async def _refresh_access_token(refresh_token_plain: str) -> tuple[str, datetime]:
    """Exchange refresh_token for a new access_token. Returns (token, expires_at)."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            _GOOGLE_TOKEN_URL,
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token_plain,
                "client_id": config.GOOGLE_CLIENT_ID,
                "client_secret": config.GOOGLE_CLIENT_SECRET,
            },
        )

    if resp.status_code != 200:
        body = resp.text
        if "invalid_grant" in body:
            raise ValueError("invalid_grant")
        raise RuntimeError(f"Token refresh failed ({resp.status_code}): {body[:200]}")

    data = resp.json()
    access_token = data["access_token"]
    expires_in = int(data.get("expires_in", 3600))
    expires_at = datetime.now(timezone.utc).replace(microsecond=0)
    from datetime import timedelta
    expires_at = expires_at + timedelta(seconds=expires_in - 60)  # 1-min safety margin
    return access_token, expires_at


def _load_connection(conn: psycopg2.extensions.connection, project_id: str) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, "refreshToken", "accessToken", "tokenExpiresAt",
                   "propertyUrl", "propertyType", status
            FROM gsc_connections
            WHERE "projectId" = %s
            """,
            (project_id,),
        )
        row = cur.fetchone()
    return dict(row) if row else None


def _update_connection_token(
    conn: psycopg2.extensions.connection,
    connection_id: str,
    access_token_encrypted: str,
    expires_at: datetime,
) -> None:
    from .crypto_utils import encrypt as _encrypt
    from .crypto_utils import encrypt
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE gsc_connections
            SET "accessToken" = %s, "tokenExpiresAt" = %s
            WHERE id = %s
            """,
            (access_token_encrypted, expires_at, connection_id),
        )
    conn.commit()


def _mark_revoked(conn: psycopg2.extensions.connection, connection_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE gsc_connections SET status = 'revoked', \"lastSyncError\" = %s WHERE id = %s",
            ("Token revoked by user (invalid_grant)", connection_id),
        )
    conn.commit()


def _mark_sync_error(conn: psycopg2.extensions.connection, connection_id: str, error: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE gsc_connections SET status = 'error', \"lastSyncError\" = %s WHERE id = %s",
            (error[:500], connection_id),
        )
    conn.commit()


def _mark_sync_complete(conn: psycopg2.extensions.connection, connection_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE gsc_connections
            SET "lastSyncAt" = NOW(), "lastSyncError" = NULL, status = 'active'
            WHERE id = %s
            """,
            (connection_id,),
        )
    conn.commit()


# ---------------------------------------------------------------------------
# GSC API calls
# ---------------------------------------------------------------------------

async def _fetch_search_analytics(
    access_token: str,
    property_url: str,
    start_date: str,
    end_date: str,
) -> list[dict]:
    """Pull all query rows from GSC searchAnalytics.query (paginated)."""
    headers = {"Authorization": f"Bearer {access_token}"}
    encoded_property = httpx.URL(property_url).path if property_url.startswith("sc-domain:") else property_url

    # URL-encode the property for the path segment
    import urllib.parse
    property_encoded = urllib.parse.quote(property_url, safe="")
    url = f"{_GSC_BASE_URL}/sites/{property_encoded}/searchAnalytics/query"

    rows: list[dict] = []
    start_row = 0

    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            payload = {
                "startDate": start_date,
                "endDate": end_date,
                "dimensions": ["query", "page", "country", "device"],
                "rowLimit": _ROW_LIMIT,
                "startRow": start_row,
            }
            resp = await client.post(url, headers=headers, json=payload)

            if resp.status_code == 401:
                raise ValueError("access_token_expired")
            if resp.status_code != 200:
                raise RuntimeError(f"GSC API error ({resp.status_code}): {resp.text[:200]}")

            data = resp.json()
            batch = data.get("rows", [])
            rows.extend(batch)

            if len(batch) < _ROW_LIMIT:
                break
            start_row += _ROW_LIMIT

    return rows


# ---------------------------------------------------------------------------
# Upsert helpers
# ---------------------------------------------------------------------------

def _upsert_query_rows(
    conn: psycopg2.extensions.connection,
    project_id: str,
    rows: list[dict],
    start_date: str,
    end_date: str,
    sync_batch_id: str,
    target_language: str,
    brand_name: str,
) -> list[dict]:
    """
    Upsert rows into gsc_query_data.
    Returns list of dicts with keys matching GscQueryData columns for further processing.
    """
    date_start = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    date_end = datetime.strptime(end_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)

    upserted_records = []

    with conn.cursor() as cur:
        for row in rows:
            keys = row.get("keys", [])
            # keys order matches dimensions: query, page, country, device
            query_text = keys[0] if len(keys) > 0 else ""
            page = keys[1] if len(keys) > 1 else None
            country = keys[2] if len(keys) > 2 else None
            device = keys[3] if len(keys) > 3 else None

            if not query_text:
                continue

            clicks = int(row.get("clicks", 0))
            impressions = int(row.get("impressions", 0))
            ctr = float(row.get("ctr", 0.0))
            position = float(row.get("position", 0.0))

            word_count = len(query_text.split())
            is_long_query = word_count >= 6

            intent_type, intent_score = classify_intent(query_text, target_language, brand_name)

            row_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO gsc_query_data (
                    id, "projectId", query, page, country, device,
                    clicks, impressions, ctr, position,
                    "dateStart", "dateEnd", "syncBatchId",
                    "intentType", "intentScore", "isLongQuery",
                    "createdAt"
                )
                VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    NOW()
                )
                ON CONFLICT ("projectId", query, country, device, "dateStart", "dateEnd")
                DO UPDATE SET
                    clicks = EXCLUDED.clicks,
                    impressions = EXCLUDED.impressions,
                    ctr = EXCLUDED.ctr,
                    position = EXCLUDED.position,
                    "syncBatchId" = EXCLUDED."syncBatchId",
                    "intentType" = EXCLUDED."intentType",
                    "intentScore" = EXCLUDED."intentScore",
                    "isLongQuery" = EXCLUDED."isLongQuery"
                """,
                (
                    row_id, project_id, query_text, page, country, device,
                    clicks, impressions, ctr, position,
                    date_start, date_end, sync_batch_id,
                    intent_type, intent_score, is_long_query,
                ),
            )

            upserted_records.append({
                "query": query_text,
                "page": page,
                "country": country,
                "device": device,
                "clicks": clicks,
                "impressions": impressions,
                "ctr": ctr,
                "position": position,
                "intentType": intent_type,
                "intentScore": intent_score,
                "isLongQuery": is_long_query,
            })

    conn.commit()
    return upserted_records


def _upsert_suggestions(
    conn: psycopg2.extensions.connection,
    project_id: str,
    suggestions: list[dict],
) -> int:
    """Insert new suggestions (skip duplicates). Returns count inserted."""
    inserted = 0
    with conn.cursor() as cur:
        for s in suggestions:
            row_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO gsc_query_suggestions (
                    id, "projectId", query, reason, "intentType",
                    impressions, clicks, "avgPosition",
                    "matchedTargetQueryId", "similarityScore",
                    status, "createdAt"
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', NOW())
                ON CONFLICT ("projectId", query) DO NOTHING
                """,
                (
                    row_id,
                    project_id,
                    s["query"],
                    s["reason"],
                    s["intentType"],
                    s["impressions"],
                    s["clicks"],
                    s["avgPosition"],
                    s.get("matchedTargetQueryId"),
                    s.get("similarityScore"),
                ),
            )
            if cur.rowcount:
                inserted += 1
    conn.commit()
    return inserted


def _upsert_intent_profiles(
    conn: psycopg2.extensions.connection,
    project_id: str,
    profiles: list[dict],
) -> int:
    """Upsert intent profiles. Returns count upserted."""
    count = 0
    with conn.cursor() as cur:
        for p in profiles:
            row_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO intent_profiles (
                    id, "projectId", name, slug, description,
                    "dominantIntent", "dominantDevice", "dominantCountry",
                    "avgQueryLength", "queryCount", "totalImpressions",
                    "topPatterns", "sampleQueries", "contextPrompt",
                    "isActive", "generatedAt"
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true, NOW())
                ON CONFLICT ("projectId", slug) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    "dominantIntent" = EXCLUDED."dominantIntent",
                    "dominantDevice" = EXCLUDED."dominantDevice",
                    "dominantCountry" = EXCLUDED."dominantCountry",
                    "avgQueryLength" = EXCLUDED."avgQueryLength",
                    "queryCount" = EXCLUDED."queryCount",
                    "totalImpressions" = EXCLUDED."totalImpressions",
                    "topPatterns" = EXCLUDED."topPatterns",
                    "sampleQueries" = EXCLUDED."sampleQueries",
                    "contextPrompt" = EXCLUDED."contextPrompt",
                    "generatedAt" = NOW()
                """,
                (
                    row_id, project_id,
                    p["name"], p["slug"], p.get("description"),
                    p["dominantIntent"], p.get("dominantDevice"), p.get("dominantCountry"),
                    p["avgQueryLength"], p["queryCount"], p["totalImpressions"],
                    json.dumps(p["topPatterns"]),
                    json.dumps(p["sampleQueries"]),
                    p.get("contextPrompt"),
                ),
            )
            count += 1
    conn.commit()
    return count


def _load_existing_target_queries(conn: psycopg2.extensions.connection, project_id: str) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "queryText" FROM target_queries WHERE "projectId" = %s AND "isActive" = true',
            (project_id,),
        )
        return [row["queryText"] for row in cur.fetchall()]


def _load_existing_target_query_ids(
    conn: psycopg2.extensions.connection, project_id: str
) -> dict[str, str]:
    """Returns {queryText: id}."""
    with conn.cursor() as cur:
        cur.execute(
            'SELECT id, "queryText" FROM target_queries WHERE "projectId" = %s AND "isActive" = true',
            (project_id,),
        )
        return {row["queryText"]: row["id"] for row in cur.fetchall()}


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def run_gsc_sync(
    conn: psycopg2.extensions.connection,
    project_id: str,
    sync_type: str,
    start_date: str,
    end_date: str,
) -> dict:
    """
    Full GSC sync pipeline for one project.

    Returns a summary dict with counts.
    Raises on unrecoverable errors (e.g. invalid_grant → connection marked revoked).
    """
    from .crypto_utils import encrypt as _encrypt

    # 1. Load connection
    connection = _load_connection(conn, project_id)
    if not connection:
        raise RuntimeError(f"No GSC connection found for project {project_id}")

    if connection["status"] == "revoked":
        raise RuntimeError("GSC connection has been revoked")

    property_url = connection.get("propertyUrl")
    if not property_url:
        raise RuntimeError("No GSC property selected for this project")

    # 2. Load project details
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "brandName", "targetLanguage" FROM projects WHERE id = %s',
            (project_id,),
        )
        project = cur.fetchone()

    if not project:
        raise RuntimeError(f"Project {project_id} not found")

    brand_name = project["brandName"] or ""
    target_language = project.get("targetLanguage") or "en"

    # 3. Decrypt + refresh access token
    try:
        refresh_token_plain = decrypt(connection["refreshToken"])
    except Exception as e:
        raise RuntimeError(f"Failed to decrypt refresh_token: {e}") from e

    try:
        new_access_token, expires_at = await _refresh_access_token(refresh_token_plain)
    except ValueError as e:
        if "invalid_grant" in str(e):
            _mark_revoked(conn, connection["id"])
            raise RuntimeError("GSC token revoked (invalid_grant). User must reconnect.") from e
        raise

    # Persist the fresh access token
    encrypted_access = _encrypt(new_access_token)
    _update_connection_token(conn, connection["id"], encrypted_access, expires_at)

    # 4. Pull data from GSC
    log.info(f"[gsc_sync] Fetching {sync_type} data for project {project_id}: {start_date} → {end_date}")
    try:
        rows = await _fetch_search_analytics(new_access_token, property_url, start_date, end_date)
    except RuntimeError as e:
        _mark_sync_error(conn, connection["id"], str(e))
        raise

    log.info(f"[gsc_sync] Fetched {len(rows)} rows from GSC for project {project_id}")

    # 5. Upsert into gsc_query_data with intent classification
    sync_batch_id = str(uuid.uuid4())
    upserted = _upsert_query_rows(
        conn, project_id, rows, start_date, end_date,
        sync_batch_id, target_language, brand_name,
    )

    # 6. Generate and upsert suggestions
    existing_target_queries = _load_existing_target_queries(conn, project_id)
    target_query_ids = _load_existing_target_query_ids(conn, project_id)

    suggestions = await generate_query_suggestions(
        project_id=project_id,
        gsc_queries=upserted,
        existing_target_queries=existing_target_queries,
        target_language=target_language,
    )

    # Resolve matchedTargetQueryId from text → id
    for s in suggestions:
        matched_text = s.get("matchedTargetQueryId")  # spec stores text here initially
        if matched_text and matched_text in target_query_ids:
            s["matchedTargetQueryId"] = target_query_ids[matched_text]
        else:
            s["matchedTargetQueryId"] = None

    suggestions_inserted = _upsert_suggestions(conn, project_id, suggestions)
    log.info(f"[gsc_sync] {suggestions_inserted} new suggestions for project {project_id}")

    # 7. Generate and upsert intent profiles
    profiles = generate_intent_profiles(
        project_id=project_id,
        gsc_queries=upserted,
        brand_name=brand_name,
        target_language=target_language,
    )
    profiles_upserted = _upsert_intent_profiles(conn, project_id, profiles)
    log.info(f"[gsc_sync] {profiles_upserted} intent profiles for project {project_id}")

    # 8. Mark sync complete
    _mark_sync_complete(conn, connection["id"])

    return {
        "rows_synced": len(rows),
        "suggestions_inserted": suggestions_inserted,
        "profiles_upserted": profiles_upserted,
        "sync_batch_id": sync_batch_id,
    }
