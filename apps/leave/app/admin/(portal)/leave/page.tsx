import { requireAdmin } from "@leave/lib/session";
import LeaveWorkspace, { type LeaveSearch } from "@leave/components/LeaveWorkspace";

export const instant = false;

export default async function AdminLeavePage({ searchParams }: { searchParams: Promise<LeaveSearch> }) {
  await requireAdmin();
  return <LeaveWorkspace params={await searchParams} />;
}
