-- CreateEnum
BEGIN;

CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'PERSONAL', 'UNPAID', 'OTHER');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaveAction" AS ENUM ('SUBMITTED', 'UPDATED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "allDay" BOOLEAN NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "returnDate" DATE NOT NULL,
    "returnTime" TEXT,
    "reason" TEXT NOT NULL,
    "requestId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "reviewerId" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveEvent" (
    "id" TEXT NOT NULL,
    "leaveId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "LeaveAction" NOT NULL,
    "before" JSONB,
    "after" JSONB NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_requestId_key" ON "LeaveRequest"("requestId");

-- CreateIndex
CREATE INDEX "LeaveRequest_userId_startsAt_idx" ON "LeaveRequest"("userId", "startsAt");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_startsAt_idx" ON "LeaveRequest"("status", "startsAt");

-- CreateIndex
CREATE INDEX "LeaveEvent_leaveId_createdAt_idx" ON "LeaveEvent"("leaveId", "createdAt");

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveEvent" ADD CONSTRAINT "LeaveEvent_leaveId_fkey" FOREIGN KEY ("leaveId") REFERENCES "LeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveEvent" ADD CONSTRAINT "LeaveEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeaveRequest"
  ADD CONSTRAINT "LeaveRequest_positive_interval" CHECK ("endsAt" > "startsAt"),
  ADD CONSTRAINT "LeaveRequest_version_positive" CHECK ("version" > 0),
  ADD CONSTRAINT "LeaveRequest_reason_length" CHECK (length(trim("reason")) BETWEEN 3 AND 1000),
  ADD CONSTRAINT "LeaveRequest_return_time" CHECK ("returnTime" IS NULL OR "returnTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT "LeaveRequest_duration_kind" CHECK (
    ("allDay" AND ("startsAt" AT TIME ZONE 'Australia/Perth')::time = time '00:00'
      AND ("endsAt" AT TIME ZONE 'Australia/Perth')::time = time '00:00')
    OR (NOT "allDay" AND ("startsAt" AT TIME ZONE 'Australia/Perth')::date = ("endsAt" AT TIME ZONE 'Australia/Perth')::date
      AND "returnTime" IS NOT NULL)
  ),
  ADD CONSTRAINT "LeaveRequest_return_after_leave" CHECK (
    (("returnDate" + coalesce("returnTime", '00:00')::time) AT TIME ZONE 'Australia/Perth') >= "endsAt"
  );

COMMIT;
