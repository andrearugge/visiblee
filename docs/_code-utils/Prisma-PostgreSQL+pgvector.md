# Setup PostgreSQL + pgvector con Prisma

## 1. Installa pgvector

```bash
sudo apt install -y postgresql-16-pgvector
```

> Sostituisci `16` con la tua versione di PostgreSQL se diversa.

---

## 2. Connettiti come superuser

```bash
sudo -u postgres psql
```

---

## 3. Dai tutti i permessi al tuo utente

```sql
GRANT ALL PRIVILEGES ON DATABASE nome_database TO nome_utente;
ALTER DATABASE nome_database OWNER TO nome_utente;
GRANT ALL ON SCHEMA public TO nome_utente;
ALTER SCHEMA public OWNER TO nome_utente;
```

---

## 4. Crea l'estensione vector

```sql
\c nome_database
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## 5. Esci e lancia le migration

```bash
\q
```

```bash
npx prisma migrate deploy
```

---

## Note

- L'estensione `vector` deve essere creata **prima** di eseguire le migration di Prisma, altrimenti si ottiene un errore `permission denied to create extension`.
- Solo un superuser PostgreSQL può installare estensioni, per questo si usa `sudo -u postgres psql`.
- In caso di migration fallita, risolverla con:

```bash
npx prisma migrate resolve --rolled-back nome_migration
npx prisma migrate deploy
```

- Sostituisci `nome_database` e `nome_utente` con i valori del tuo ambiente.