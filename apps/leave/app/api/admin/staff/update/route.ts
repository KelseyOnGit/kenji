import { apiError, readBody } from "@kenji/web/api";
import { requireAdminApi } from "@leave/lib/session";
import { updateStaffSchema } from "@leave/lib/contracts";
import { updateStaffDetails } from "@leave/lib/staff-writes";

export async function POST(request: Request) {
  try {
    await requireAdminApi();                                  // 401 unless signed in as an admin
    const input = await readBody(request, updateStaffSchema); // 400 with a clear message if anything is invalid
    await updateStaffDetails(input);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Update staff details");
  }
}