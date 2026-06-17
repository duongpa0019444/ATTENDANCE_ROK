-- AlterTable
ALTER TABLE "shifts" ADD COLUMN     "bonus_days" TEXT;

-- CreateTable
CREATE TABLE "server_salary_histories" (
    "id" TEXT NOT NULL,
    "server_id" TEXT NOT NULL,
    "base_salary" DOUBLE PRECISION NOT NULL,
    "start_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_salary_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "server_salary_histories_server_id_start_date_key" ON "server_salary_histories"("server_id", "start_date");

-- AddForeignKey
ALTER TABLE "server_salary_histories" ADD CONSTRAINT "server_salary_histories_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
