import { z } from "zod";
import { apiError, readBody } from "@kenji/web/api";
import { deleteStaffSession } from "@leave/lib/session";

export async function POST(request: Request) {
  try {
    await readBody(request, z.object({}).strict());
    await deleteStaffSession();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Staff logout");
  }
}
