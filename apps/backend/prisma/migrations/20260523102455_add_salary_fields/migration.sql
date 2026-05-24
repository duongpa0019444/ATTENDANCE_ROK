-- AlterTable
ALTER TABLE "servers" ADD COLUMN     "base_salary" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "shifts" ADD COLUMN     "base_salary" DOUBLE PRECISION,
ADD COLUMN     "bonus_salary" DOUBLE PRECISION NOT NULL DEFAULT 0;
