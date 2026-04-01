# Azioni Manuali — Visiblee v2

Questo file raccoglie tutte le azioni che richiedono intervento manuale (infrastruttura, DB, pannelli esterni).
Spunta ogni voce quando completata.

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
