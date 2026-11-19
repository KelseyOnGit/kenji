import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import StaffLoginPage from "@leave/app/login/page";
import AdminLoginPage from "@leave/app/admin/login/page";

describe("phone-or-email sign-in markup", () => {
  it.each([["staff", StaffLoginPage], ["admin", AdminLoginPage]] as const)(
    "%s accepts both identifiers and never defaults to sending credentials in the URL",
    (_, Page) => {
      const html = renderToStaticMarkup(createElement(Page));
      expect(html).toContain("Phone number or email");
      expect(html).toContain('name="identifier"');
      expect(html).toContain('autoComplete="username"');
      expect(html).not.toContain('type="email"');
      expect(html).toMatch(/<form\b[^>]*\bmethod="post"/);
    },
  );
});
