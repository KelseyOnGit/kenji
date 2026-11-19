import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), pathname: "/admin" }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@kenji/database", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ now: new Date("2026-01-05T00:00:00Z") }]),
    shift: { count: vi.fn().mockResolvedValue(0), findFirst: vi.fn().mockResolvedValue(null) },
    leaveRequest: { count: vi.fn().mockResolvedValue(0) },
  },
}));
vi.mock("@leave/lib/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@leave/components/LogoutButton", () => ({
  default: ({ admin }: { admin?: boolean }) => createElement("button", null, admin ? "Admin sign out" : "Staff sign out"),
}));

import AdminSidebar from "@leave/components/AdminSidebar";
import AdminLayout from "@leave/app/admin/(portal)/layout";
import AdminHome from "@leave/app/admin/(portal)/page";

beforeEach(() => {
  mocks.requireAdmin.mockReset();
  mocks.pathname = "/admin";
  mocks.requireAdmin.mockResolvedValue({ id: "admin-id", displayName: "Test Admin", email: "admin@example.com" });
});

describe("leave admin shell", () => {
  it("shows the requested menu without dead links or fabricated badges", () => {
    const html = renderToStaticMarkup(createElement(AdminSidebar, { displayName: "Test Admin" }));
    for (const label of ["Dashboard", "Staff Profiles", "Pending approval", "Leave Requests", "Timesheets"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain('href="/admin"');
    expect(html).toContain('aria-current="page"');
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(2);
    expect(html.match(/>Soon</g)).toHaveLength(2);
    expect(html.match(/href=/g)).toHaveLength(3);
    expect(html).toContain('href="/admin/leave"');
    expect(html).toContain('href="/admin/timesheets"');
    expect(html).toContain("Test Admin");
    expect(html).toContain("Admin sign out");
  });

  it("highlights Timesheets instead of Dashboard on the timesheet page", () => {
    mocks.pathname = "/admin/timesheets";
    const html = renderToStaticMarkup(createElement(AdminSidebar, { displayName: "Admin" }));
    expect(html).toMatch(/<a(?=[^>]*href="\/admin\/timesheets")(?=[^>]*aria-current="page")[^>]*>/);
    expect(html).not.toMatch(/<a(?=[^>]*href="\/admin")(?=[^>]*aria-current="page")[^>]*>/);
  });

  it("checks admin access in both the sidebar layout and landing page", async () => {
    const layout = await AdminLayout({ children: createElement("p", null, "Protected content") });
    const home = await AdminHome();
    expect(mocks.requireAdmin).toHaveBeenCalledTimes(2);
    expect(renderToStaticMarkup(layout)).toContain('id="admin-content"');
    expect(renderToStaticMarkup(home)).toContain("Dashboard");
  });

  it("does not render protected content if the admin guard redirects", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(AdminLayout({ children: createElement("p", null, "Protected content") })).rejects.toThrow("NEXT_REDIRECT");
    await expect(AdminHome()).rejects.toThrow("NEXT_REDIRECT");
  });
});
