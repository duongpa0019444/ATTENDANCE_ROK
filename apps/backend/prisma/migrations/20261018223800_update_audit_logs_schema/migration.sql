-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "page" TEXT DEFAULT 'SYSTEM';
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "summary" TEXT;
ALTER TABLE "audit_logs" ALTER COLUMN "entity_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_page_created_at_idx" ON "audit_logs"("page", "created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");
