import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { ApiError, apiError, readBody } from "@/lib/api";
import { loginSchema } from "@/lib/contracts";
import { createSession } from "@/lib/session";

// Compared against when the email doesn't exist, so a wrong email takes as long
// as a wrong password and the response time can't reveal which emails are real.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function POST(request: Request) {
  try {
    const { email, password } = await readBody(request, loginSchema);

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, status: true, passwordHash: true },
    });

    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordOk || user.role !== "ADMIN") {
      throw new ApiError(401, "Incorrect email or password.");
    }
    if (user.status !== "ACTIVE") {
      throw new ApiError(403, "This account is inactive.");
    }

    await createSession(user.id);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error, "Login");
  }
}