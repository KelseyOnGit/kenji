CREATE TABLE "StaffSession" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialDigest" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffSession_pkey" PRIMARY KEY ("tokenHash")
);

CREATE INDEX "StaffSession_userId_idx" ON "StaffSession"("userId");
CREATE INDEX "StaffSession_expiresAt_idx" ON "StaffSession"("expiresAt");
ALTER TABLE "StaffSession" ADD CONSTRAINT "StaffSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StaffLoginWindow" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "StaffLoginWindow_pkey" PRIMARY KEY ("key"),
    CONSTRAINT "StaffLoginWindow_positive_attempts" CHECK ("attempts" > 0)
);

CREATE INDEX "StaffLoginWindow_expiresAt_idx" ON "StaffLoginWindow"("expiresAt");
