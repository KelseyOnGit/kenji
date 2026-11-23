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
  const [missing, oldest, pendingLeave, pendingStaff] = await Promise.all([
    prisma.shift.count({ where }),
    prisma.shift.findFirst({ where, select: { clockIn: true }, orderBy: { clockIn: "asc" } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { role: "STAFF", status: "PENDING" } }),
  ]);
  const week = toPerthLocal(parseWeekParam(oldest ? toPerthLocal(oldest.clockIn).slice(0, 10) : undefined)).slice(0, 10);
  return (
    <section className="card">
      <p className="eyebrow">Admin panel</p>
      <h1>Dashboard</h1>
      <p>Your admin workspace starts here.</p>
      <p className="login-switch"><Link href={`/admin/timesheets?problems=1&week=${week}`}>{missing} shift(s) with a missing clock-out</Link></p>
      <p className="login-switch"><Link href="/admin/leave">{pendingLeave} pending leave request(s)</Link></p>
      <p className="login-switch"><Link href="/admin/pending-approval">{pendingStaff} staff registration(s) awaiting approval</Link></p>
      <div className="note">
        Timesheets, leave requests and staff account approvals are ready for review.
        Full staff profiles are coming next.
      </div>
    </section>
  );
}
