# Azioni Manuali — Visiblee v2

Questo file raccoglie tutte le azioni che richiedono intervento manuale (infrastruttura, DB, pannelli esterni).
Spunta ogni voce quando completata.

---

## Fase A.0

### [ ] A.0.1 — Applicare migration `robotsTxtBlocks` su contents + indice trend su citation_checks

L'utente applicativo (`visiblee_remote2`) non ha permessi `ALTER TABLE`, quindi la migration non può essere applicata automaticamente.

**Dove**: Hetzner DB server via Ploi o accesso diretto psql con superuser.

**SQL da eseguire**:
```sql
-- Colonna robotsTxtBlocks su contents (oggi calcolata dal fetcher e persa)
ALTER TABLE "contents"
  ADD COLUMN IF NOT EXISTS "robotsTxtBlocks" TEXT[] NOT NULL DEFAULT '{}';

-- Indice composito per query Beta(α, β) veloce sullo storico citation
CREATE INDEX IF NOT EXISTS "citation_checks_project_query_checked_at_desc_idx"
  ON "citation_checks" ("projectId", "targetQueryId", "checkedAt" DESC);
```

**Poi**: registrare la migration nel registro Prisma:
```sql
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (gen_random_uuid(), 'placeholder', NOW(), '20260430000000_phase_a_0_prereq', NULL, NULL, NOW(), 1);
```

> Nota: il checksum esatto non è critico perché la migration è composta da statement idempotenti senza dipendenze dal lock state.

---

## Fase A

### [ ] A.1 — Applicare migration `scheduledAt` sul DB

L'utente applicativo (`visiblee_remote2`) non ha permessi `ALTER TABLE`, quindi la migration non può essere applicata automaticamente.

**Dove**: Hetzner DB server via Ploi o accesso diretto psql con superuser.

**SQL da eseguire**:
```sql
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
```

**Poi**: segnare la migration come applicata nel registro Prisma:
```sql
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
  gen_random_uuid(),
  'placeholder',
  NOW(),
  '20260331000000_add_scheduled_at_to_jobs',
  NULL, NULL, NOW(), 1
);
```

> Nota: il checksum esatto non è critico in questo caso perché la migration è un singolo `ALTER TABLE` senza dipendenze.

---

## Fase B

### [ ] B.2 — Applicare migration `competitor_query_appearances`

**Dove**: Hetzner DB server via Ploi o accesso diretto psql con superuser.

**SQL da eseguire**:
```sql
CREATE TABLE "competitor_query_appearances" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "targetQueryId" TEXT NOT NULL,
    "citationCheckId" TEXT NOT NULL,
    "position" INTEGER,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "competitor_query_appearances_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "competitor_query_appearances_competitorId_idx" ON "competitor_query_appearances"("competitorId");
CREATE INDEX "competitor_query_appearances_targetQueryId_idx" ON "competitor_query_appearances"("targetQueryId");
CREATE INDEX "competitor_query_appearances_citationCheckId_idx" ON "competitor_query_appearances"("citationCheckId");
ALTER TABLE "competitor_query_appearances" ADD CONSTRAINT "competitor_query_appearances_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "competitor_query_appearances" ADD CONSTRAINT "competitor_query_appearances_targetQueryId_fkey" FOREIGN KEY ("targetQueryId") REFERENCES "target_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "competitor_query_appearances" ADD CONSTRAINT "competitor_query_appearances_citationCheckId_fkey" FOREIGN KEY ("citationCheckId") REFERENCES "citation_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**Poi**: registrare nel registro Prisma:
```sql
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (gen_random_uuid(), 'placeholder', NOW(), '20260401000001_add_competitor_query_appearances', NULL, NULL, NOW(), 1);
```

---

### [ ] B.1 — Applicare migration `targetQueryId` su recommendations

**Dove**: Hetzner DB server via Ploi o accesso diretto psql con superuser.

**SQL da eseguire** (in ordine):
```sql
ALTER TABLE "recommendations" ADD COLUMN "targetQueryId" TEXT;

CREATE INDEX "recommendations_targetQueryId_idx" ON "recommendations"("targetQueryId");

ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_targetQueryId_fkey"
  FOREIGN KEY ("targetQueryId") REFERENCES "target_queries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

**Poi**: registrare la migration nel registro Prisma:
```sql
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (gen_random_uuid(), 'placeholder', NOW(), '20260401000000_add_target_query_id_to_recommendations', NULL, NULL, NOW(), 1);
```

---

## Fase C

### [ ] C.2 — Applicare migration `detectedLanguage` su contents

**Dove**: Hetzner DB server via Ploi o accesso diretto psql con superuser.

**SQL da eseguire**:
```sql
ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "detectedLanguage" TEXT;
```

**Poi**: registrare nel registro Prisma:
```sql
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (gen_random_uuid(), 'placeholder', NOW(), '20260401000002_add_detected_language_to_content', NULL, NULL, NOW(), 1);
```

---

## Fase D

### [ ] D.1 — Applicare migration `expert_conversations` + `expert_messages`

**Dove**: Hetzner DB server via Ploi o accesso diretto psql con superuser.

**SQL da eseguire**: vedi file `apps/web/prisma/migrations/20260401000003_add_expert_models/migration.sql`

```sql
CREATE TABLE "expert_conversations" (
    "id"               TEXT NOT NULL,
    "project_id"       TEXT NOT NULL,
    "recommendation_id" TEXT,
    "target_query_id"  TEXT,
    "title"            TEXT NOT NULL,
    "context_payload"  JSONB NOT NULL,
    "status"           TEXT NOT NULL DEFAULT 'active',
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expert_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expert_messages" (
    "id"              TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role"            TEXT NOT NULL,
    "content"         TEXT NOT NULL,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expert_messages_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "expert_conversations"
    ADD CONSTRAINT "expert_conversations_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "expert_messages"
    ADD CONSTRAINT "expert_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "expert_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "expert_conversations_project_id_idx" ON "expert_conversations"("project_id");
CREATE INDEX "expert_messages_conversation_id_idx" ON "expert_messages"("conversation_id");
```

**Poi**: registrare nel registro Prisma:
```sql
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (gen_random_uuid(), 'placeholder', NOW(), '20260401000003_add_expert_models', NULL, NULL, NOW(), 1);
```

### [ ] D.1b — Aggiungere `GOOGLE_AI_API_KEY` alle variabili Vercel

La stessa chiave già usata dal Python service (`GOOGLE_AI_API_KEY`) deve essere aggiunta al progetto Vercel (Settings → Environment Variables).

---

## Fase E

### [ ] E.1 — Applicare migration `source`/`manualDescription`/`manualSampleQueries` su intent_profiles

**Dove**: Hetzner DB server via Ploi o accesso diretto psql con superuser.

**SQL da eseguire**:
```sql
ALTER TABLE "intent_profiles"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'gsc',
  ADD COLUMN IF NOT EXISTS "manualDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "manualSampleQueries" TEXT[] NOT NULL DEFAULT '{}';
```

**Poi**: registrare nel registro Prisma:
```sql
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (gen_random_uuid(), 'placeholder', NOW(), '20260401000004_add_intent_profile_manual', NULL, NULL, NOW(), 1);
```

---

## Fase F

### [ ] F.3 — Applicare migration `competitor_gap_reports` (tabella dedicata)

**Dove**: Hetzner DB server via Ploi o accesso diretto psql con superuser.

**SQL da eseguire**:
```sql
CREATE TABLE "competitor_gap_reports" (
    "id"           TEXT NOT NULL,
    "projectId"    TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "generatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gaps"         JSONB NOT NULL,
    CONSTRAINT "competitor_gap_reports_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "competitor_gap_reports"
  ADD CONSTRAINT "competitor_gap_reports_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competitor_gap_reports"
  ADD CONSTRAINT "competitor_gap_reports_competitorId_fkey"
  FOREIGN KEY ("competitorId") REFERENCES "competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "competitor_gap_reports_projectId_idx" ON "competitor_gap_reports"("projectId");
CREATE INDEX "competitor_gap_reports_competitorId_idx" ON "competitor_gap_reports"("competitorId");

-- Aggiungere lastAnalyzedAt su competitors per la cache 30 giorni
ALTER TABLE "competitors"
  ADD COLUMN IF NOT EXISTS "lastAnalyzedAt" TIMESTAMP(3);
```

**Poi**: registrare nel registro Prisma:
```sql
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (gen_random_uuid(), 'placeholder', NOW(), '20260601000000_add_competitor_gap_report', NULL, NULL, NOW(), 1);
```

---

### [ ] F.4 — Applicare migration `priority` + `jobChannel` su jobs

**Dove**: Hetzner DB server via Ploi o accesso diretto psql con superuser.

**SQL da eseguire**:
```sql
ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "priority"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "jobChannel" TEXT    NOT NULL DEFAULT 'default';

-- Indice per claim_job filtrato per channel
CREATE INDEX IF NOT EXISTS "jobs_jobChannel_status_createdAt_idx"
  ON "jobs" ("jobChannel", "status", "createdAt");
```

**Poi**: registrare nel registro Prisma:
```sql
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (gen_random_uuid(), 'placeholder', NOW(), '20260601000001_add_job_priority_channel', NULL, NULL, NOW(), 1);
```

### [ ] F.4b — Configurare 3 servizi worker su Ploi

Dopo la migration F.4, lanciare 3 istanze del worker (una per canale) sul server Hetzner via Ploi.

Comandi (uno per servizio Ploi):
```bash
python /home/visiblee/services/analyzer/run_worker.py --channel fast
python /home/visiblee/services/analyzer/run_worker.py --channel heavy
python /home/visiblee/services/analyzer/run_worker.py --channel default
```

Configurare auto-restart su crash. Documentare i 3 servizi in `docs/staging-setup.md`.

---

### [ ] F.5 — Applicare migration `htmlTruncated` su contents

**Dove**: Hetzner DB server via Ploi o accesso diretto psql con superuser.

**SQL da eseguire**:
```sql
ALTER TABLE "contents"
  ADD COLUMN IF NOT EXISTS "htmlTruncated" BOOLEAN NOT NULL DEFAULT FALSE;
```

**Poi**: registrare nel registro Prisma:
```sql
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (gen_random_uuid(), 'placeholder', NOW(), '20260601000002_add_html_truncated', NULL, NULL, NOW(), 1);
```

---
