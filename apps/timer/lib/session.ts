import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";

const COOKIE = "kenji_session";
const MAX_AGE = 60 * 60 * 8; // 8 hours, like sha

// Read the secret when it's needed (not at import time), so builds don't crash
function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET must be set (32+ characters).");
  return new TextEncoder().encode(secret);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function deleteSession() {
  (await cookies()).delete(COOKIE);
}

export type Admin = { id: string; displayName: string; email: string | null };

/** The signed-in admin, or null. Checks the database every time, like sha. */
export async function getAdmin(): Promise<Admin | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  let userId: unknown;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    userId = payload.userId;
  } catch {
    return null; // expired or tampered with
  }
  if (typeof userId !== "string") return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, email: true, role: true, status: true },
  });
  if (!user || user.role !== "ADMIN" || user.status !== "ACTIVE") return null;
  return { id: user.id, displayName: user.displayName, email: user.email };
}

/** Use at the top of every admin PAGE */
export async function requireAdminPage(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect("/login");
  return admin;
}

/** Use at the top of every admin API ROUTE */
export async function requireAdminApi(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) throw new ApiError(401, "Please sign in as an admin.");
  return admin;
}