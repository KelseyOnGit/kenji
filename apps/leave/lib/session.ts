import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@kenji/database";
import { ApiError } from "@kenji/web/api";

const COOKIE = "kenji_leave_session";
const ADMIN_COOKIE = "kenji_leave_admin_session";
const MAX_AGE = 60 * 60 * 8;
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");

async function createSession(userId: string, credential: string, cookie: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.staffSession.create({
    data: {
      tokenHash: digest(token),
      userId,
      credentialDigest: digest(credential),
      expiresAt: new Date(Date.now() + MAX_AGE * 1000),
    },
  });
  (await cookies()).set(cookie, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

async function deleteSession(cookie: string) {
  const jar = await cookies();
  const token = jar.get(cookie)?.value;
  if (token) await prisma.staffSession.deleteMany({ where: { tokenHash: digest(token) } });
  jar.delete(cookie);
}

async function getSession(cookie: string, role: "STAFF" | "ADMIN") {
  const token = (await cookies()).get(cookie)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const session = await prisma.staffSession.findUnique({
    where: { tokenHash: digest(token) },
    include: { user: { select: { id: true, displayName: true, email: true, role: true, status: true, pinHash: true, passwordHash: true } } },
  });
  if (!session || session.expiresAt <= new Date() || session.user.role !== role
    || session.user.status !== "ACTIVE") return null;
  const credential = role === "ADMIN"
    ? session.user.passwordHash && `admin:${session.user.passwordHash}`
    : session.user.pinHash;
  if (!credential || session.credentialDigest !== digest(credential)) return null;
  return { id: session.user.id, displayName: session.user.displayName, email: session.user.email };
}

export const createStaffSession = (userId: string, pinHash: string) => createSession(userId, pinHash, COOKIE);
export const deleteStaffSession = () => deleteSession(COOKIE);
export const getStaff = () => getSession(COOKIE, "STAFF");

export const createAdminSession = (userId: string, passwordHash: string) => createSession(userId, `admin:${passwordHash}`, ADMIN_COOKIE);
export const deleteAdminSession = () => deleteSession(ADMIN_COOKIE);
export const getAdmin = () => getSession(ADMIN_COOKIE, "ADMIN");

export async function requireStaff() {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  return staff;
}

export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function requireAdminApi() {
  const admin = await getAdmin();
  if (!admin) throw new ApiError(401, "Please sign in as an admin.");
  return admin;
}
