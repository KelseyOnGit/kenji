import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import PendingApprovals from "@leave/components/PendingApprovals";

describe("pending approval page", () => {
  it("shows registration details and a review action without exposing employment fields", () => {
    const html = renderToStaticMarkup(createElement(PendingApprovals, {
      initialPeople: [{
        id: "staff-id",
        legalName: "Kelsey Wang",
        displayName: "Kelsey",
        email: "kelsey@example.com",
        phone: "0412 345 678",
        registeredAt: "23 Nov 2026, 13:00",
        possibleDuplicate: null,
      }],
    }));
    expect(html).toContain("Pending approval");
    expect(html).toContain("Kelsey Wang");
    expect(html).toContain("kelsey@example.com");
    expect(html).toContain("0412 345 678");
    expect(html).toContain("Review profile");
    expect(html).not.toContain("Employment type");
  });

  it("shows an empty-state when no registrations are waiting", () => {
    const html = renderToStaticMarkup(createElement(PendingApprovals, { initialPeople: [] }));
    expect(html).toContain("All caught up");
    expect(html).toContain("0 pending");
  });
});
