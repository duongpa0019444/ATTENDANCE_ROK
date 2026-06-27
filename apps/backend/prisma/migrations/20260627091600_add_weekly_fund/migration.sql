-- CreateTable
CREATE TABLE "weekly_funds" (
    "id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_funds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "weekly_funds_start_date_key" ON "weekly_funds"("start_date");

-- AlterTable
ALTER TABLE "locked_payrolls" ADD COLUMN     "fund_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "total_fund_shared" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payroll_adjustments" ADD COLUMN     "fund_percent" DOUBLE PRECISION NOT NULL DEFAULT 0;
