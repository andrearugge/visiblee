"""
Scheduler — periodic job creator for Visiblee Analyzer.

Run this script via cron (Ploi) to create scheduled jobs for all active projects.
It must exit after each run; the OS scheduler handles the cadence.

Usage:
    python -m app.scheduler

Ploi cron configuration (see docs/staging-setup.md):
    Command : cd /var/www/analyzer && .venv/bin/python -m app.scheduler
    Schedule: * * * * *  (every minute — the script decides internally what to create)

Phase A will implement the actual job creation logic. For now this is a
placeholder that verifies the DB connection and exits cleanly.
"""

from __future__ import annotations

import logging
import warnings

warnings.filterwarnings("ignore", category=DeprecationWarning, module="urllib3")
warnings.filterwarnings("ignore", message=".*NotOpenSSLWarning.*")
warnings.filterwarnings("ignore", message=".*end of life.*", category=FutureWarning)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

import psycopg2
import psycopg2.extras

from .config import config


def get_conn() -> psycopg2.extensions.connection:
    return psycopg2.connect(config.DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def run() -> None:
    log.info("Scheduler run — connecting to DB...")
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        log.info("Scheduler run — no jobs to create yet.")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
