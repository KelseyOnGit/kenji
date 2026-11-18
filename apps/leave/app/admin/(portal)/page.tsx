import { requireAdmin } from "@leave/lib/session";
import Link from "next/link";
import { prisma } from "@kenji/database";
import { databaseNow } from "@leave/lib/timesheet-writes";
import { MAX_SHIFT_HOURS, parseWeekParam, toPerthLocal } from "@leave/lib/timesheets";

export const instant = false;

export default async function AdminHome() {
  await requireAdmin();
  const now = await databaseNow(prisma);
  const where = {
    clockOut: null,
    clockIn: { lte: new Date(now.getTime() - MAX_SHIFT_HOURS * 3600000) },
    user: { role: "STAFF" as const },
  };
  const [missing, oldest] = await Promise.all([
    prisma.shift.count({ where }),
    prisma.shift.findFirst({ where, select: { clockIn: true }, orderBy: { clockIn: "asc" } }),
  ]);
  const week = toPerthLocal(parseWeekParam(oldest ? toPerthLocal(oldest.clockIn).slice(0, 10) : undefined)).slice(0, 10);
  return (
    <section className="card">
      <p className="eyebrow">Admin panel</p>
      <h1>Dashboard</h1>
      <p>Your admin workspace starts here.</p>
      <p className="login-switch"><Link href={`/admin/timesheets?problems=1&week=${week}`}>{missing} shift(s) with a missing clock-out</Link></p>
      <div className="note">
        Timesheets are ready for review and corrections. Staff profiles, pending approvals,
        and leave requests are coming soon.
      </div>
    </section>
  );
}
