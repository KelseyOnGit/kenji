import { prisma } from "@kenji/database";
import { requireAdminApi } from "@leave/lib/session";
import { ApiError, apiError, readBody } from "@kenji/web/api";
import { timesheetEditSchema } from "@leave/lib/contracts";
import { perthLocalToDate } from "@leave/lib/timesheets";
import { auditTimes, correctionSelect, lockStaff, shiftOwner, validateTimes } from "@leave/lib/timesheet-writes";

export async function POST(request: Request) {
  try {
    const admin = await requireAdminApi();
    const input = await readBody(request, timesheetEditSchema);
    const userId = await shiftOwner(input.shiftId);
    await prisma.$transaction(async tx => {
      const user = await lockStaff(tx, userId);
      const shift = await tx.shift.findUnique({ where: { id: input.shiftId }, select: correctionSelect });
      if (!shift || shift.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()) {
        throw new ApiError(409, "This shift was changed by someone else. Refresh the timesheet and review it before editing.");
      }
      if (!shift.clockOut) throw new ApiError(409, "This shift is still open. Refresh and use Set clock-out instead.");
      const clockIn = perthLocalToDate(input.clockIn), clockOut = perthLocalToDate(input.clockOut);
      await validateTimes(tx, user, clockIn, clockOut, shift.id);
      const after = await tx.shift.update({
        where: { id: shift.id }, data: { clockIn, clockOut, edited: true }, select: correctionSelect,
      });
      await tx.shiftAudit.create({
        data: { shiftId: shift.id, actorId: admin.id, action: "EDIT_TIMES", before: auditTimes(shift), after: auditTimes(after), reason: input.reason },
      });
    });
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error, "Edit timesheet"); }
}
