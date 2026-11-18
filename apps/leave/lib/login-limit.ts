import { createHash } from "node:crypto";
import { prisma } from "@kenji/database";
import { ApiError } from "@kenji/web/api";

export async function limitLogin(email: string, audience: "staff" | "admin") {
  const prefix = audience === "admin" ? "leave-admin-login" : "leave-login";
  const key = createHash("sha256").update(`${prefix}:${email}`).digest("hex");
  const [window] = await prisma.$queryRaw<{ attempts: number }[]>`
    INSERT INTO "StaffLoginWindow" ("key", "attempts", "expiresAt")
    VALUES (${key}, 1, clock_timestamp() + interval '15 minutes')
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "StaffLoginWindow"."expiresAt" <= clock_timestamp()
        THEN 1 ELSE least("StaffLoginWindow"."attempts" + 1, 6) END,
      "expiresAt" = CASE WHEN "StaffLoginWindow"."expiresAt" <= clock_timestamp()
        THEN clock_timestamp() + interval '15 minutes' ELSE "StaffLoginWindow"."expiresAt" END
    RETURNING "attempts"
  `;
  if (!window) throw new Error("Login attempt limit could not be recorded.");
  if (window.attempts > 5) throw new ApiError(429, "Too many sign-in attempts for this email. Please try again in 15 minutes.");
}
