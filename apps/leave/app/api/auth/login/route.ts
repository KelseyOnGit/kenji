import bcrypt from "bcrypt";
import { prisma } from "@kenji/database";
import { ApiError, apiError, readBody } from "@kenji/web/api";
import { staffLoginSchema } from "@leave/lib/contracts";
import { createStaffSession } from "@leave/lib/session";
import { resolveLogin } from "@leave/lib/login-identity";

const DUMMY_HASH = bcrypt.hashSync("not-a-staff-pin", 10);

export async function POST(request: Request) {
  try {
    const { identifier, pin } = await readBody(request, staffLoginSchema);
    const identity = await resolveLogin(identifier, "staff");
    const user = identity && await prisma.user.findUnique({
      where: { id: identity.id },
      select: { id: true, pinHash: true, role: true, status: true },
    });
    const valid = await bcrypt.compare(pin, user?.pinHash ?? DUMMY_HASH);
    if (!user || !valid || user.role !== "STAFF" || user.status !== "ACTIVE") {
      throw new ApiError(401, "Incorrect phone number, email or PIN, or your profile is not active. Please contact us if you need help.");
    }
    await createStaffSession(user.id, user.pinHash);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = apiError(error, "Staff login");
    if (response.status === 429) response.headers.set("Retry-After", "900");
    return response;
  }
}
