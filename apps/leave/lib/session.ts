import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@kenji/database";

const COOKIE = "kenji_leave_session";
const MAX_AGE = 60 * 60 * 8;
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export async function createStaffSession(userId: string, pinHash: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.staffSession.create({
    data: {
      tokenHash: digest(token),
      userId,
      credentialDigest: digest(pinHash),
      expiresAt: new Date(Date.now() + MAX_AGE * 1000),
    },
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function deleteStaffSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await prisma.staffSession.deleteMany({ where: { tokenHash: digest(token) } });
  jar.delete(COOKIE);
}

export async function getStaff() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const session = await prisma.staffSession.findUnique({
    where: { tokenHash: digest(token) },
    include: { user: { select: { id: true, displayName: true, email: true, role: true, status: true, pinHash: true } } },
  });
  if (!session || session.expiresAt <= new Date() || session.user.role !== "STAFF"
    || session.user.status !== "ACTIVE" || session.credentialDigest !== digest(session.user.pinHash)) return null;
  return { id: session.user.id, displayName: session.user.displayName, email: session.user.email };
}

export async function requireStaff() {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  return staff;
}
