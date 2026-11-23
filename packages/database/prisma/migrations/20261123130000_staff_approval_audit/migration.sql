BEGIN;

ALTER TABLE "User"
  ADD COLUMN "approvedAt" TIMESTAMPTZ(3),
  ADD COLUMN "approvedById" TEXT;

ALTER TABLE "User"
  ADD CONSTRAINT "User_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "User_approvedById_idx" ON "User"("approvedById");

COMMIT;
