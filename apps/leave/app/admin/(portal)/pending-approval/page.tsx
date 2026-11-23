import PendingApprovals from "@leave/components/PendingApprovals";
import { requireAdmin } from "@leave/lib/session";
import { pendingStaff } from "@leave/lib/staff-data";

export const instant = false;

export default async function PendingApprovalPage() {
  await requireAdmin();
  return <PendingApprovals initialPeople={await pendingStaff()} />;
}
