import { apiError, readBody } from "@kenji/web/api";
import { requireStaffApi } from "@leave/lib/session";
import { leaveEditSchema } from "@leave/lib/contracts";
import { editLeave } from "@leave/lib/leave-writes";

export async function POST(request: Request) {
  try {
    const staff = await requireStaffApi();
    await editLeave(staff.id, await readBody(request, leaveEditSchema));
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error, "Edit leave request"); }
}
