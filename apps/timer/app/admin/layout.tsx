import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { requireAdminPage } from "@/lib/session";

export const instant = false;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdminPage();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center gap-6 border-b px-6 py-3">
        <strong>Kenji Admin</strong>
        <nav className="flex gap-4">
          <Link href="/admin">Dashboard</Link>
          <Link href="/admin/staff">Staff</Link>
          <Link href="/admin/timesheets">Timesheets</Link>
        </nav>
        <span className="ml-auto text-sm">{admin.displayName}</span>
        <LogoutButton />
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}