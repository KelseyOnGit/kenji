import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, apiError, readBody } from "@/lib/api";
import { registrationSchema } from "@/lib/contracts";
import { normalizePhone } from "@kenji/web/identity";

export async function POST(request: Request) {
  try {
    const input = await readBody(request, registrationSchema);
    const autoApprove = process.env.AUTO_APPROVE_STAFF;
    if (autoApprove !== undefined && autoApprove !== "true" && autoApprove !== "false") {
      throw new Error("AUTO_APPROVE_STAFF must be true or false.");
    }
    const status = autoApprove === "true" ? "ACTIVE" : "PENDING";
    const pinHash = await bcrypt.hash(input.pin, 10);
    await prisma.user.create({
      data: {
        legalName: input.fullName,
        displayName: input.displayName ?? input.fullName,
        pinHash,
        contactNumber: input.contactNumber,
        phone: input.contactNumber ? normalizePhone(input.contactNumber) : null,
        email: input.email,
        role: "STAFF",
        status,
      },
      select: { id: true },
    });
    return Response.json({ status }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError(new ApiError(409, "That email or phone number is already registered. Contact us if you need help."), "Register");
    }
    return apiError(error, "Register");
  }
}
