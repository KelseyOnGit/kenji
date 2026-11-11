import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, apiError, readBody } from "@/lib/api";
import { registrationSchema } from "@/lib/contracts";

export async function POST(request: Request) {
  try {
    const input = await readBody(request, registrationSchema);
    const pinHash = await bcrypt.hash(input.pin, 10);
    await prisma.user.create({
      data: {
        legalName: input.fullName,
        displayName: input.displayName ?? input.fullName,
        pinHash,
        contactNumber: input.contactNumber,
        email: input.email,
        role: "STAFF",
        status: "PENDING",
      },
      select: { id: true },
    });
    return Response.json({ status: "PENDING" }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError(new ApiError(409, "That email is already registered. Contact your manager if you need help."), "Register");
    }
    return apiError(error, "Register");
  }
}
