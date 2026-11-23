"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@leave/components/LogoutButton";

export default function AdminSidebar({ displayName, pendingStaff }: { displayName: string; pendingStaff: number }) {
  const pathname = usePathname();
  return (
    <aside className="admin-sidebar">
      <div>
        <div className="brand">SSS <span>Auto Parts</span></div>
        <p className="eyebrow">Admin panel</p>
      </div>
      <nav className="admin-nav" aria-label="Admin navigation">
        <Link href="/admin" aria-current={pathname === "/admin" ? "page" : undefined}>Dashboard</Link>
        <span className="admin-nav-upcoming" aria-disabled="true"><span>Staff Profiles</span><span className="upcoming-label">Soon</span></span>
        <Link href="/admin/pending-approval" aria-current={pathname.startsWith("/admin/pending-approval") ? "page" : undefined}>
          <span>Pending approval</span>{pendingStaff > 0 && <span className="upcoming-label">{pendingStaff}</span>}
        </Link>
        <Link href="/admin/leave" aria-current={pathname.startsWith("/admin/leave") ? "page" : undefined}>Leave Requests</Link>
        <Link href="/admin/timesheets" aria-current={pathname.startsWith("/admin/timesheets") ? "page" : undefined}>Timesheets</Link>
      </nav>
      <div className="admin-sidebar-footer">
        <p className="admin-account-label">Signed in as</p>
        <p className="admin-account-name">{displayName}</p>
        <LogoutButton admin />
      </div>
    </aside>
  );
}
