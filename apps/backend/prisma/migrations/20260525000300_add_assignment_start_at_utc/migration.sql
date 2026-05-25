ALTER TABLE "shift_assignments"
ADD COLUMN IF NOT EXISTS "start_at_utc" TIMESTAMP(3);

UPDATE "shift_assignments" AS sa
SET "start_at_utc" = sa."work_date"::timestamp + (s."start_time" || ':00')::time
FROM "shifts" AS s
WHERE s."id" = sa."shift_id"
  AND sa."start_at_utc" IS NULL;

CREATE INDEX IF NOT EXISTS "shift_assignments_start_at_utc_idx"
  ON "shift_assignments"("start_at_utc");
