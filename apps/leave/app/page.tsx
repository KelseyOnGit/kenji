import { requireStaff } from "@leave/lib/session";
import LogoutButton from "@leave/components/LogoutButton";
import LeaveWorkspace, { type LeaveSearch } from "@leave/components/LeaveWorkspace";
import styles from "@leave/components/leave.module.css";

export const instant = false;

export default async function StaffHome({ searchParams }: { searchParams: Promise<LeaveSearch> }) {
  const staff = await requireStaff();
  return (
    <main className={styles.staffShell}>
      <header className="topbar"><div className="brand">SSS <span>Auto Parts</span></div><span>{staff.displayName}</span><LogoutButton /></header>
      <LeaveWorkspace params={await searchParams} staffId={staff.id} />
    </main>
  );
}
