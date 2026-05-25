CREATE TABLE IF NOT EXISTS "payroll_allowances" (
  "id" TEXT NOT NULL,
  "work_date" DATE NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_allowances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_allowances_work_date_key"
  ON "payroll_allowances"("work_date");
