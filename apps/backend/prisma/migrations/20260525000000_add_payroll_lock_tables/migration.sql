-- Align migration history with the current payroll lock schema.
-- This migration is intentionally tolerant because the development database
-- already had these changes applied outside Prisma migrations.

ALTER TABLE "attendance_logs"
  DROP COLUMN IF EXISTS "checkin_at",
  DROP COLUMN IF EXISTS "late_minutes";

ALTER TABLE "shifts"
  ADD COLUMN IF NOT EXISTS "week_start_date" DATE;

CREATE TABLE IF NOT EXISTS "locked_periods" (
  "id" TEXT NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "locked_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "locked_payrolls" (
  "id" TEXT NOT NULL,
  "locked_period_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "total_shifts" INTEGER NOT NULL,
  "completed_shifts" INTEGER NOT NULL,
  "absent_shifts" INTEGER NOT NULL,
  "total_base_salary" DOUBLE PRECISION NOT NULL,
  "total_night_bonus" DOUBLE PRECISION NOT NULL,
  "total_weekend_bonus" DOUBLE PRECISION NOT NULL,
  "total_shift_reward" DOUBLE PRECISION NOT NULL,
  "total_salary" DOUBLE PRECISION NOT NULL,
  "details" JSONB NOT NULL,

  CONSTRAINT "locked_payrolls_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "locked_payrolls_locked_period_id_fkey"
    FOREIGN KEY ("locked_period_id") REFERENCES "locked_periods"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "locked_periods_start_date_end_date_key"
  ON "locked_periods"("start_date", "end_date");

CREATE UNIQUE INDEX IF NOT EXISTS "locked_payrolls_locked_period_id_user_id_key"
  ON "locked_payrolls"("locked_period_id", "user_id");
