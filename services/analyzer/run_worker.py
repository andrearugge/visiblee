"""
Standalone worker entrypoint for Visiblee Analyzer.

Runs the job worker independently from the FastAPI process.
Both can run in parallel:

    # Terminal 1 — API server
    uvicorn app.main:app --reload --port 8000

    # Terminal 2 — Job worker
    python run_worker.py

On Hetzner/Ploi, configure these as two separate processes/services.
"""

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
    asyncio.run(run_worker())
