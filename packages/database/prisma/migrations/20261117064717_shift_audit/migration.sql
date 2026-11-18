-- CreateTable
CREATE TABLE "ShiftAudit" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftAudit_shiftId_createdAt_idx" ON "ShiftAudit"("shiftId", "createdAt");

-- AddForeignKey
ALTER TABLE "ShiftAudit" ADD CONSTRAINT "ShiftAudit_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAudit" ADD CONSTRAINT "ShiftAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShiftAudit" ADD CONSTRAINT "ShiftAudit_action_valid"
  CHECK ("action" IN ('SET_CLOCK_OUT', 'EDIT_TIMES', 'ADD_SHIFT'));
