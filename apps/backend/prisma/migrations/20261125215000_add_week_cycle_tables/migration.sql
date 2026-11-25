-- CreateTable
CREATE TABLE IF NOT EXISTS "week_cycle_rules" (
    "id" TEXT NOT NULL,
    "start_day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL DEFAULT '07:00',
    "end_time" TEXT NOT NULL DEFAULT '06:59',
    "effective_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "week_cycle_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "custom_week_periods" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "start_date" DATE NOT NULL,
    "start_time" TEXT NOT NULL DEFAULT '07:00',
    "end_date" DATE NOT NULL,
    "end_time" TEXT NOT NULL DEFAULT '06:59',
    "total_days" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_week_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "week_cycle_rules_effective_date_key" ON "week_cycle_rules"("effective_date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "custom_week_periods_start_date_end_date_key" ON "custom_week_periods"("start_date", "end_date");

-- Seed default base Monday rule (idempotent)
INSERT INTO "week_cycle_rules" ("id", "start_day_of_week", "start_time", "end_time", "effective_date")
VALUES ('00000000-0000-0000-0000-000000000001', 1, '07:00', '06:59', DATE '2026-01-01')
ON CONFLICT ("effective_date") DO NOTHING;
