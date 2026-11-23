import { apiError, readBody } from "@kenji/web/api";
import { requireAdminApi } from "@leave/lib/session";
import { approveStaffSchema } from "@leave/lib/contracts";
import { approvePendingStaff } from "@leave/lib/staff-writes";

export async function POST(request: Request) {
  try {
    const admin = await requireAdminApi();
    const { userId } = await readBody(request, approveStaffSchema);
    await approvePendingStaff(admin.id, userId);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Approve staff");
  }
}
