import { prisma } from "@kenji/database";
import { ApiError } from "@kenji/web/api";


import { Prisma } from "@prisma/client";
import { formatPhoneForDisplay, normalizePhone } from "@kenji/web/identity";
import type { UpdateStaffInput } from "./contracts";

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

/**
 * Admin edits a staff member's details. Uses the same row lock as approval, so two admins
 * (or an approval and an edit) can't overwrite each other.
 */
export async function updateStaffDetails(input: UpdateStaffInput) {
  const phone = input.phone ? normalizePhone(input.phone) : null; // "0412 345 678" → "+61412345678"
  try {
    await prisma.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${input.userId} FOR UPDATE`;
      const user = await transaction.user.findUnique({
        where: { id: input.userId },
        select: { role: true, updatedAt: true },
      });
      if (!user || user.role !== "STAFF") {
        throw new ApiError(404, "This staff profile was not found.");
      }
      // The form sends back the updatedAt it was opened with. If it differs, someone else saved in between.
      if (user.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()) {
        throw new ApiError(409, "Someone else changed this profile. Refresh to see the latest details, then try again.");
      }
      await transaction.user.update({
        where: { id: input.userId },
        data: {
          legalName: input.legalName,
          displayName: input.displayName,
          phone,
          // Keep the legacy display field aligned with the normalized sign-in phone.
          contactNumber: phone ? formatPhoneForDisplay(phone) : null,
          email: input.email,
          employmentType: input.employmentType,
        },
      });
    });
  } catch (error) {
    // P2002 = a unique column clashed: the phone or email already belongs to someone else.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = String(error.meta?.target ?? "");
      throw new ApiError(409, target.includes("phone")
        ? "That phone number is already used by another person."
        : target.includes("email")
          ? "That email is already used by another person."
          : "That phone number or email is already used by another person.");
    }
    throw error;
  }
}