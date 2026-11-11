import { prisma } from "@/lib/prisma";
import { ApiError, apiError } from "@/lib/api";

type SearchRow = {
  id: string;
  displayName: string;
  shiftId: string | null;
  clockIn: Date | null;
};

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  try {
    if (query.length > 120) throw new ApiError(400, "Search using no more than 120 characters.");
    if (!query) {
      return Response.json({ staff: [], hasMore: false }, { headers: { "Cache-Control": "no-store" } });
    }
    const namePrefix = query.toLowerCase();
    const phonePrefix = /^[+\d\s().-]+$/.test(query) ? query.replace(/\D/g, "") : "";
    // Compare literal prefixes, not LIKE patterns, so '%' and '_' are not wildcards.
    const users = await prisma.$queryRaw<SearchRow[]>`
      SELECT u."id", u."displayName", s."id" AS "shiftId", s."clockIn"
      FROM "User" u
      LEFT JOIN "Shift" s ON s."userId" = u."id" AND s."clockOut" IS NULL
      WHERE u."role" = 'STAFF' AND u."status" = 'ACTIVE'
        AND (
          starts_with(lower(u."displayName"), ${namePrefix})
          OR starts_with(lower(u."legalName"), ${namePrefix})
          OR (${phonePrefix} <> '' AND starts_with(
            regexp_replace(coalesce(u."contactNumber", ''), '[^0-9]', '', 'g'), ${phonePrefix}
          ))
        )
      ORDER BY lower(u."displayName"), u."id"
      LIMIT 21
    `;
    return Response.json({
      staff: users.slice(0, 20).map((user) => ({
        id: user.id,
        displayName: user.displayName,
        currentShift: user.shiftId && user.clockIn ? { id: user.shiftId, clockIn: user.clockIn } : null,
      })),
      hasMore: users.length > 20,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Staff search");
  }
}
