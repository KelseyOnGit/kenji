import { prisma } from "@kenji/database";
import { ApiError } from "@kenji/web/api";

export async function approvePendingStaff(adminId: string, userId: string) {
  return prisma.$transaction(async transaction => {
    await transaction.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const user = await transaction.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });
    if (!user || user.role !== "STAFF") {
      throw new ApiError(404, "This staff registration was not found.");
    }
    if (user.status !== "PENDING") {
      throw new ApiError(409, "This registration is no longer pending. Refresh the page.");
    }
    const [{ now }] = await transaction.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
    await transaction.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE", approvedAt: now, approvedById: adminId },
    });
  });
}
