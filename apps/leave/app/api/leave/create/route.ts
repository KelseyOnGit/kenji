import { apiError, readBody } from "@kenji/web/api";
import { requireStaffApi } from "@leave/lib/session";
import { leaveCreateSchema } from "@leave/lib/contracts";
import { createLeave } from "@leave/lib/leave-writes";

export async function POST(request: Request) {
  try {
    const staff = await requireStaffApi();
    await createLeave(staff.id, await readBody(request, leaveCreateSchema));
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error, "Submit leave request"); }
}
