import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";

export default async function AdminHome() {
  await requireAdminPage(); // check here too: layouts don't re-run on navigation

  const [pending, onShift] = await Promise.all([
    prisma.user.count({ where: { status: "PENDING" } }),
    prisma.shift.count({ where: { clockOut: null } }),
  ]);

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p>{pending} registration(s) waiting for approval</p>
      <p>{onShift} staff currently clocked in</p>
    </div>
  );
}