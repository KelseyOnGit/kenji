import { Prisma } from "@prisma/client";
import { prisma } from "@kenji/database";
import { ApiError } from "@kenji/web/api";
import { MAX_SHIFT_HOURS, perthDisplay } from "./timesheets";

type Times = { clockIn: Date; clockOut: Date | null };
export const auditTimes = (shift: Times) => ({
  clockIn: shift.clockIn.toISOString(), clockOut: shift.clockOut?.toISOString() ?? null,
});

export async function lockStaff(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  const user = await tx.user.findUnique({
    where: { id: userId }, select: { id: true, displayName: true, role: true, status: true },
  });
  if (!user || user.role !== "STAFF" || !["ACTIVE", "INACTIVE"].includes(user.status)) {
    throw new ApiError(400, "Choose an active or inactive staff member, then try again.");
  }
  return user;
}

export async function databaseNow(tx: Prisma.TransactionClient) {
  const [row] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
  if (!row) throw new Error("Database time is unavailable.");
  return row.now;
}

export async function validateTimes(
  tx: Prisma.TransactionClient, user: { id: string; displayName: string },
  clockIn: Date, clockOut: Date, excludeId?: string,
) {
  const now = await databaseNow(tx);
  if (clockOut <= clockIn) throw new ApiError(400, "Clock-out must be after clock-in. Check both dates and times.");
  if (clockOut > now) throw new ApiError(400, "Clock-out cannot be in the future. Enter a finished shift in Perth time.");
  if (clockOut.getTime() - clockIn.getTime() > MAX_SHIFT_HOURS * 3600000) {
    throw new ApiError(400, "A shift cannot be longer than 16 hours. Check the dates and times.");
  }
  const overlap = await tx.shift.findFirst({
    where: {
      userId: user.id, ...(excludeId ? { id: { not: excludeId } } : {}),
      clockIn: { lt: clockOut }, OR: [{ clockOut: null }, { clockOut: { gt: clockIn } }],
    },
    select: { clockIn: true, clockOut: true }, orderBy: { clockIn: "asc" },
  });
  if (overlap) {
    const start = perthDisplay(overlap.clockIn, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const end = overlap.clockOut
      ? perthDisplay(overlap.clockOut, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      : "still clocked in";
    throw new ApiError(409, `This shift overlaps ${user.displayName}'s shift on ${start} - ${end}. Edit that shift instead.`);
  }
}

export async function shiftOwner(shiftId: string) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId }, select: { userId: true } });
  if (!shift) throw new ApiError(404, "This shift could not be found. Refresh the timesheet.");
  return shift.userId;
}

export const correctionSelect = {
  id: true, clockIn: true, clockOut: true, updatedAt: true,
} satisfies Prisma.ShiftSelect;
