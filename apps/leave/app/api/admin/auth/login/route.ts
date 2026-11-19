import bcrypt from "bcrypt";
import { prisma } from "@kenji/database";
import { ApiError, apiError, readBody } from "@kenji/web/api";
import { adminLoginSchema } from "@leave/lib/contracts";
import { resolveLogin } from "@leave/lib/login-identity";
import { createAdminSession } from "@leave/lib/session";

const DUMMY_HASH = bcrypt.hashSync("not-an-admin-password", 10);

export async function POST(request: Request) {
  try {
    const { identifier, password } = await readBody(request, adminLoginSchema);
    const identity = await resolveLogin(identifier, "admin");
    const user = identity && await prisma.user.findUnique({
      where: { id: identity.id },
      select: { id: true, passwordHash: true, role: true, status: true },
    });
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user?.passwordHash || !valid || user.role !== "ADMIN" || user.status !== "ACTIVE") {
      throw new ApiError(401, "Incorrect phone number, email or password, or this account does not have admin access. Please contact us if you need help.");
    }
    await createAdminSession(user.id, user.passwordHash);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = apiError(error, "Leave admin login");
    if (response.status === 429) response.headers.set("Retry-After", "900");
    return response;
  }
}
