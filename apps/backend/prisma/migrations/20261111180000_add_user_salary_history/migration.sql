-- CreateTable
CREATE TABLE IF NOT EXISTS "user_salary_histories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "custom_base_salary" DOUBLE PRECISION,
    "start_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_salary_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_salary_histories_user_id_start_date_key" ON "user_salary_histories"("user_id", "start_date");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_salary_histories_user_id_fkey'
    ) THEN
        ALTER TABLE "user_salary_histories" ADD CONSTRAINT "user_salary_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

