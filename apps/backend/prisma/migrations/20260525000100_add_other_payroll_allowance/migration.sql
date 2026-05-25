ALTER TABLE "locked_payrolls"
ADD COLUMN IF NOT EXISTS "total_other_allowance" DOUBLE PRECISION NOT NULL DEFAULT 0;

INSERT INTO "settings" ("key", "value")
VALUES ('OTHER_ALLOWANCE', '0')
ON CONFLICT ("key") DO NOTHING;
