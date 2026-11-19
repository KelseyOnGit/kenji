import { prisma } from "@kenji/database";
import { ApiError } from "@kenji/web/api";
import { parseLoginIdentifier } from "@kenji/web/identity";
import { limitLogin } from "./login-limit";

export async function resolveLogin(identifier: string, audience: "staff" | "admin") {
  const parsed = parseLoginIdentifier(identifier);
  if (!parsed) throw new ApiError(400, "Enter a valid phone number or email address.");
  await limitLogin(parsed.value, audience);
  const users = await prisma.user.findMany({
    where: parsed.kind === "email"
      ? { email: { equals: parsed.value, mode: "insensitive" } }
      : { phone: parsed.value },
    select: { id: true },
    take: 2,
  });
  const user = users.length === 1 ? users[0] : null;
  // Both login identifiers share an account limit; unknown identifiers remain limited too.
  if (user) await limitLogin(`account:${user.id}`, audience);
  return user;
}
