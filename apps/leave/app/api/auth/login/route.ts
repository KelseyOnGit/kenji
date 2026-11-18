import bcrypt from "bcrypt";
import { prisma } from "@kenji/database";
import { ApiError, apiError, readBody } from "@kenji/web/api";
import { staffLoginSchema } from "@leave/lib/contracts";
import { createStaffSession } from "@leave/lib/session";
import { limitLogin } from "@leave/lib/login-limit";

const DUMMY_HASH = bcrypt.hashSync("not-a-staff-pin", 10);

export async function POST(request: Request) {
  try {
    const { email, pin } = await readBody(request, staffLoginSchema);
    await limitLogin(email, "staff");
    const users = await prisma.user.findMany({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, pinHash: true, role: true, status: true },
      take: 2,
    });
    const user = users.length === 1 ? users[0] : null;
    const valid = await bcrypt.compare(pin, user?.pinHash ?? DUMMY_HASH);
    if (!user || !valid || user.role !== "STAFF" || user.status !== "ACTIVE") {
      throw new ApiError(401, "Incorrect email or PIN, or your profile is not active. Please contact us if you need help.");
    }
    await createStaffSession(user.id, user.pinHash);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = apiError(error, "Staff login");
    if (response.status === 429) response.headers.set("Retry-After", "900");
    return response;
  }
}
