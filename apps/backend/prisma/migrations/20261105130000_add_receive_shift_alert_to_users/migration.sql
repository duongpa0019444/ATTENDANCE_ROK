-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "receive_shift_alert" BOOLEAN NOT NULL DEFAULT false;

-- Set existing ADMIN and MANAGER to true so they keep receiving notifications by default until explicitly turned off
UPDATE "users" SET "receive_shift_alert" = true WHERE "role" IN ('ADMIN', 'MANAGER');

