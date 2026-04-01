-- Migration: add ExpertConversation and ExpertMessage models (Phase D.1)
-- Run with a superuser if shadow DB is not available.

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

-- Foreign keys
ALTER TABLE "expert_conversations"
    ADD CONSTRAINT "expert_conversations_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "expert_messages"
    ADD CONSTRAINT "expert_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "expert_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "expert_conversations_project_id_idx" ON "expert_conversations"("project_id");
CREATE INDEX "expert_messages_conversation_id_idx" ON "expert_messages"("conversation_id");

-- Auto-update updated_at trigger for expert_conversations
CREATE OR REPLACE FUNCTION update_expert_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER expert_conversations_updated_at
    BEFORE UPDATE ON "expert_conversations"
    FOR EACH ROW EXECUTE FUNCTION update_expert_conversations_updated_at();
