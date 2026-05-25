DROP INDEX IF EXISTS "shift_assignments_start_at_utc_idx";

ALTER TABLE "shift_assignments"
DROP COLUMN IF EXISTS "start_at_utc";
