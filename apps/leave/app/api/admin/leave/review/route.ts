import { apiError, readBody } from "@kenji/web/api";
import { requireAdminApi } from "@leave/lib/session";
import { leaveReviewSchema } from "@leave/lib/contracts";
import { reviewLeave } from "@leave/lib/leave-writes";

export async function POST(request: Request) {
  try {
    const admin = await requireAdminApi();
    await reviewLeave(admin.id, await readBody(request, leaveReviewSchema));
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error, "Review leave request"); }
}
