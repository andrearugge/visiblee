"""
Standalone worker entrypoint for Visiblee Analyzer.

Runs the job worker independently from the FastAPI process.
Both can run in parallel:

    # Terminal 1 — API server
    uvicorn app.main:app --reload --port 8000

    # Terminal 2–4 — Job workers (one per channel)
    python run_worker.py --channel fast
    python run_worker.py --channel heavy
    python run_worker.py --channel default

Channels:
  fast    — preview_analysis, send_preview_report, fetch_content, citation checks
  heavy   — full_analysis, competitor_analysis, sitemap_import, scheduled_analysis
  default — discovery, gsc_sync, cleanup

On Hetzner/Ploi, configure these as three separate processes/services.
See docs/staging-setup.md for Ploi configuration.
"""

import argparse
import asyncio
import logging
import warnings

# Suppress known harmless warnings on macOS with Python 3.9 / LibreSSL
warnings.filterwarnings("ignore", category=DeprecationWarning, module="urllib3")
warnings.filterwarnings("ignore", message=".*NotOpenSSLWarning.*")
warnings.filterwarnings("ignore", message=".*end of life.*", category=FutureWarning)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

from app.worker import run_worker

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Visiblee job worker")
    parser.add_argument(
        "--channel",
        default="default",
        choices=["fast", "heavy", "default"],
        help="Job channel to process (default: default)",
    )
    args = parser.parse_args()
    asyncio.run(run_worker(channel=args.channel))
