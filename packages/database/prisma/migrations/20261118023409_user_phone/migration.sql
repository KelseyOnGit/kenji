/*
  Warnings:

  - A unique constraint covering the columns `[phone]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
BEGIN;

ALTER TABLE "User" ADD COLUMN     "phone" TEXT;
WITH cleaned AS (
  SELECT "id", regexp_replace(trim(coalesce("contactNumber", '')), '[[:space:]().-]', '', 'g') AS d
  FROM "User"
)
UPDATE "User" u SET "phone" = CASE
  WHEN c.d ~ '^0[2-478][0-9]{8}$'         THEN '+61' || substr(c.d, 2)
  WHEN c.d ~ '^\+?610?[2-478][0-9]{8}$'   THEN '+61' || regexp_replace(c.d, '^\+?610?', '')
  WHEN c.d ~ '^\+[1-9][0-9]{7,14}$' AND c.d !~ '^\+61' THEN c.d
  ELSE NULL END
FROM cleaned c WHERE c."id" = u."id";
--backfill: copy existing phone numbers into the new column if needed

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

ALTER TABLE "User" ADD CONSTRAINT "User_phone_e164" CHECK ("phone" ~ '^\+[1-9][0-9]{7,14}$');

COMMIT;