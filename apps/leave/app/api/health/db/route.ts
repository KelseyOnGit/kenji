import { prisma } from "@kenji/database";
import { apiError } from "@kenji/web/api";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ database: "connected" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Database health");
  }
}
