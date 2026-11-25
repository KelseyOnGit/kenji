import StaffProfiles from "@leave/components/StaffProfiles";
import { requireAdmin } from "@leave/lib/session";
import { staffCounts, staffList, type StaffStatus } from "@leave/lib/staff-data";

export const instant = false;

export default async function StaffPage({ searchParams }: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const validStatuses: StaffStatus[] = ["ACTIVE", "PENDING", "INACTIVE"];
  const requested = typeof params.status === "string" ? params.status : "ACTIVE";
  const status = validStatuses.includes(requested as StaffStatus)
    ? requested as StaffStatus
    : "ACTIVE";
  const [people, counts] = await Promise.all([staffList(status), staffCounts()]);

  return <StaffProfiles initialPeople={people} initialStatus={status} counts={counts} />;
}
