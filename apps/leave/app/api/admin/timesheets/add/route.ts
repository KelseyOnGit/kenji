import { prisma } from "@kenji/database";
import { requireAdminApi } from "@leave/lib/session";
import { ApiError, apiError, readBody } from "@kenji/web/api";
import { timesheetAddSchema } from "@leave/lib/contracts";
import { addedShiftTimes } from "@leave/lib/timesheets";
import { auditTimes, correctionSelect, lockStaff, validateTimes } from "@leave/lib/timesheet-writes";

export async function POST(request: Request) {
  try {
    const admin = await requireAdminApi();
    const input = await readBody(request, timesheetAddSchema);
    await prisma.$transaction(async tx => {
      const user = await lockStaff(tx, input.userId);
      const existing = await tx.shift.findFirst({
        where: { OR: [{ clockInRequestId: input.requestId }, { clockOutRequestId: input.requestId }] },
        select: { userId: true, clockInRequestId: true },
      });
      if (existing) {
        if (existing.userId === user.id && existing.clockInRequestId === input.requestId) return;
        throw new ApiError(409, "This request was already used for another shift. Close this form and open Add shift again.");
      }
      const { clockIn, clockOut } = addedShiftTimes(input.date, input.startTime, input.endTime);
      await validateTimes(tx, user, clockIn, clockOut);
      const shift = await tx.shift.create({
        data: { userId: user.id, clockIn, clockOut, clockInRequestId: input.requestId, edited: true },
        select: correctionSelect,
      });
      await tx.shiftAudit.create({
        data: { shiftId: shift.id, actorId: admin.id, action: "ADD_SHIFT", after: auditTimes(shift), reason: input.reason },
      });
    });
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error, "Add timesheet shift"); }
}
