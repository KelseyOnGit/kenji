import { apiError, readBody } from "@kenji/web/api";
import { requireStaffApi } from "@leave/lib/session";
import { leaveCancelSchema } from "@leave/lib/contracts";
import { cancelLeave } from "@leave/lib/leave-writes";

export async function POST(request: Request) {
  try {
    const staff = await requireStaffApi();
    const input = await readBody(request, leaveCancelSchema);
    await cancelLeave(staff.id, input.leaveId, input.expectedVersion);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error, "Cancel leave request"); }
}
