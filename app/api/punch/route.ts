import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { ApiError, apiError, readBody } from "@/lib/api";
import { punchSchema } from "@/lib/contracts";

export async function POST(request: Request) {
  try {
    const input = await readBody(request, punchSchema);
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, pinHash: true, status: true, role: true },
    });
    if (!user || user.status !== "ACTIVE" || user.role !== "STAFF") {
      throw new ApiError(403, "This staff profile is not active. Please contact your manager.");
    }
    if (!await bcrypt.compare(input.pin, user.pinHash)) {
      throw new ApiError(401, "Incorrect PIN. Please try again.");
    }

    const result = await prisma.$transaction(async (tx) => {
      // Serialize all punch requests for this user, including requests from other iPads.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${input.userId} FOR UPDATE`;
      const currentUser = await tx.user.findUnique({
        where: { id: input.userId },
        select: { status: true, role: true, pinHash: true, displayName: true },
      });
      if (!currentUser || currentUser.status !== "ACTIVE" || currentUser.role !== "STAFF"
        || currentUser.pinHash !== user.pinHash) {
        throw new ApiError(403, "Your profile changed. Please select your name and enter your PIN again.");
      }

      const previous = await tx.shift.findFirst({
        where: { OR: [{ clockInRequestId: input.requestId }, { clockOutRequestId: input.requestId }] },
      });
      if (previous) {
        const sameAction = input.action === "CLOCK_IN"
          ? previous.clockInRequestId === input.requestId
          : previous.clockOutRequestId === input.requestId;
        if (previous.userId !== input.userId || !sameAction) {
          throw new ApiError(409, "This request was already used. Please select your name again.");
        }
        return {
          action: input.action,
          displayName: currentUser.displayName,
          occurredAt: input.action === "CLOCK_IN" ? previous.clockIn : previous.clockOut,
        };
      }

      const openShift = await tx.shift.findFirst({ where: { userId: input.userId, clockOut: null } });
      if ((openShift?.id ?? null) !== input.expectedShiftId) {
        throw new ApiError(409, "Your shift has changed. Please select your name again to see its current status.");
      }
      if (input.action === "CLOCK_IN") {
        const shift = await tx.shift.create({
          data: { userId: input.userId, clockInRequestId: input.requestId },
        });
        return { action: input.action, displayName: currentUser.displayName, occurredAt: shift.clockIn };
      }
      if (!openShift) throw new ApiError(409, "No open shift was found. Please select your name again.");

      // Use the database clock, not the iPad's clock, for attendance records.
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
      if (now < openShift.clockIn) throw new ApiError(409, "The shift start time is in the future. Please contact your manager.");
      const shift = await tx.shift.update({
        where: { id: openShift.id },
        data: { clockOut: now, clockOutRequestId: input.requestId },
      });
      return { action: input.action, displayName: currentUser.displayName, occurredAt: shift.clockOut };
    });

    return Response.json(result);
  } catch (error) {
    return apiError(error, "Punch");
  }
}
