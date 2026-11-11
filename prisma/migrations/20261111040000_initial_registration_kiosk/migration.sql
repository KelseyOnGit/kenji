-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CASUAL');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "employmentType" "EmploymentType",
    "contactNumber" TEXT,
    "email" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clockIn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockOut" TIMESTAMPTZ(3),
    "clockInRequestId" UUID NOT NULL,
    "clockOutRequestId" UUID,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayRate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hourlyRate" DECIMAL(10,2) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_displayName_idx" ON "User"("status", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_clockInRequestId_key" ON "Shift"("clockInRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_clockOutRequestId_key" ON "Shift"("clockOutRequestId");

-- CreateIndex
CREATE INDEX "Shift_userId_clockOut_idx" ON "Shift"("userId", "clockOut");

-- CreateIndex
CREATE INDEX "Shift_clockIn_idx" ON "Shift"("clockIn");

-- CreateIndex
CREATE UNIQUE INDEX "PayRate_userId_effectiveFrom_key" ON "PayRate"("userId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRate" ADD CONSTRAINT "PayRate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot express a partial unique index. Keep this in future migrations.
CREATE UNIQUE INDEX "Shift_one_open_per_user" ON "Shift"("userId") WHERE "clockOut" IS NULL;

ALTER TABLE "Shift" ADD CONSTRAINT "Shift_clock_order" CHECK ("clockOut" IS NULL OR "clockOut" >= "clockIn");
