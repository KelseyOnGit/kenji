import bcrypt from "bcrypt";
import { prisma } from "@kenji/database";
import { ApiError, apiError, readBody } from "@kenji/web/api";
import { adminLoginSchema } from "@leave/lib/contracts";
import { limitLogin } from "@leave/lib/login-limit";
import { createAdminSession } from "@leave/lib/session";

const DUMMY_HASH = bcrypt.hashSync("not-an-admin-password", 10);

export async function POST(request: Request) {
  try {
    const { email, password } = await readBody(request, adminLoginSchema);
    await limitLogin(email, "admin");
    const users = await prisma.user.findMany({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, passwordHash: true, role: true, status: true },
      take: 2,
    });
    const user = users.length === 1 ? users[0] : null;
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user?.passwordHash || !valid || user.role !== "ADMIN" || user.status !== "ACTIVE") {
      throw new ApiError(401, "Incorrect email or password, or this account does not have admin access. Please contact us if you need help.");
    }
    await createAdminSession(user.id, user.passwordHash);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = apiError(error, "Leave admin login");
    if (response.status === 429) response.headers.set("Retry-After", "900");
    return response;
  }
}
