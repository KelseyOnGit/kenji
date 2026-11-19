import { prisma } from "@kenji/database";
import { apiError } from "@kenji/web/api";

export async function GET() {
  try {
    await prisma.leaveRequest.findFirst({ select: { id: true } });
    return Response.json({ database: "connected" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Database health");
  }
}
