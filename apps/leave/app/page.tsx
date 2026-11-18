import { requireStaff } from "@leave/lib/session";
import LogoutButton from "@leave/components/LogoutButton";

export const instant = false;

export default async function StaffHome() {
  const staff = await requireStaff();
  return (
    <main className="shell">
      <header className="topbar"><div className="brand">SSS <span>Auto Parts</span></div><LogoutButton /></header>
      <section className="card">
        <p className="eyebrow">Staff portal</p>
        <h1>Welcome, {staff.displayName}.</h1>
        <p>Signed in as {staff.email}.</p>
        <p>Your profile and clock PIN are shared with the timer app.</p>
        <div className="note">Leave requests and profile screens are coming next.</div>
      </section>
    </main>
  );
}
