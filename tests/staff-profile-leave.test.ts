import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StaffProfileLeave } from "@leave/components/StaffProfileDialog";
import type { StaffProfile } from "@leave/lib/staff-data";

describe("staff profile leave tab", () => {
  it("renders leave request details when profile data is present", () => {
    const person: StaffProfile = {
      id: "staff-id",
      displayName: "Kelsey",
      legalName: "Kelsey Wang",
      status: "ACTIVE",
      email: "kelsey@example.com",
      phone: "0412 345 678",
      registeredAt: "20 Nov 2026, 09:00",
      updatedAt: "2026-11-24T00:00:00.000Z",
      employmentType: "FULL_TIME",
      leave: [{
        id: "leave-id",
        type: "ANNUAL",
        status: "PENDING",
        startsAt: "2026-11-23T16:00:00.000Z",
        endsAt: "2026-11-24T16:00:00.000Z",
        allDay: true,
        returnDate: "2026-11-25",
        returnTime: null,
        reason: "Family trip",
        decisionNote: null,
        reviewer: null,
        submittedAt: "23 Nov 2026, 09:00",
      }],
    };
    const html = renderToStaticMarkup(createElement(StaffProfileLeave, { requests: person.leave }));
    expect(html).toContain("Annual leave");
    expect(html).toContain("Family trip");
    expect(html).toContain("Showing the 25 most recent requests");
    expect(html).not.toContain("Leave history will be added next");
  });
});
