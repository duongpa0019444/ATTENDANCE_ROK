-- CreateTable
CREATE TABLE "shift_day_bonuses" (
    "id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "work_date" DATE NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_day_bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_day_bonuses_shift_id_work_date_key" ON "shift_day_bonuses"("shift_id", "work_date");

-- AddForeignKey
ALTER TABLE "shift_day_bonuses" ADD CONSTRAINT "shift_day_bonuses_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
