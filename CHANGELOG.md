# Changelog

## [Unreleased]

### Phase 0 — Infrastructure & Staging

#### 0.1 — Staging database configuration
- Created `.env.staging.example` with all required variables for `visiblee_dev` staging database
- Added Staging Setup section to `README.md` documenting the staging database, OAuth, and Vercel configuration

#### 0.4 — Scheduler placeholder
- Created `services/analyzer/app/scheduler.py` — connects to DB, logs "no jobs to create yet", exits
- Documents Ploi cron command inline; full setup in `docs/staging-setup.md` (Task 0.5)

#### 0.3 — Worker/FastAPI separation
- Removed job worker from FastAPI lifespan — `uvicorn app.main:app` starts with no background tasks
- Created `services/analyzer/run_worker.py` as standalone worker entrypoint (`python run_worker.py`)
- Updated README dev setup to reflect two separate processes

#### 0.2 — Vercel staging deployment documentation
- Expanded README Staging section with step-by-step Vercel project setup
- Documented separate Vercel project for `dev` branch, domain `dev.visiblee.ai`
- Documented Google OAuth redirect URIs for staging
- Documented Python microservice staging port strategy
