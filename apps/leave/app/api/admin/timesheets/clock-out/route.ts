import { prisma } from "@kenji/database";
import { requireAdminApi } from "@leave/lib/session";
import { ApiError, apiError, readBody } from "@kenji/web/api";
import { timesheetClockOutSchema } from "@leave/lib/contracts";
import { perthLocalToDate } from "@leave/lib/timesheets";
import { auditTimes, correctionSelect, lockStaff, shiftOwner, validateTimes } from "@leave/lib/timesheet-writes";

export async function POST(request: Request) {
  try {
    const admin = await requireAdminApi();
    const input = await readBody(request, timesheetClockOutSchema);
    const userId = await shiftOwner(input.shiftId);
    await prisma.$transaction(async tx => {
      const user = await lockStaff(tx, userId);
      const shift = await tx.shift.findUnique({ where: { id: input.shiftId }, select: correctionSelect });
      if (!shift || shift.clockOut) throw new ApiError(409, "This shift is no longer open. Refresh the timesheet before making a correction.");
      const clockOut = perthLocalToDate(input.clockOut);
      await validateTimes(tx, user, shift.clockIn, clockOut, shift.id);
      const after = await tx.shift.update({
        where: { id: shift.id }, data: { clockOut, edited: true }, select: correctionSelect,
      });
      await tx.shiftAudit.create({
        data: { shiftId: shift.id, actorId: admin.id, action: "SET_CLOCK_OUT", before: auditTimes(shift), after: auditTimes(after), reason: input.reason },
      });
    });
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error, "Set timesheet clock-out"); }
}
