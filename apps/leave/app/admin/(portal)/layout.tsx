import AdminSidebar from "@leave/components/AdminSidebar";
import { requireAdmin } from "@leave/lib/session";
import { pendingStaffCount } from "@leave/lib/staff-data";

export const instant = false;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const pendingCount = await pendingStaffCount();
  return (
    <div className="admin-shell">
      <a className="skip-link" href="#admin-content">Skip to content</a>
      <AdminSidebar displayName={admin.displayName} pendingStaff={pendingCount} />
      <main id="admin-content" className="admin-content" tabIndex={-1}>{children}</main>
    </div>
  );
}
