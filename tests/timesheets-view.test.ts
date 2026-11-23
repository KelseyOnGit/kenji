import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import TimesheetTable from "@leave/components/TimesheetTable";

describe("weekly timesheet table", () => {
  it("counts completed minutes only and keeps overnight work on its clock-in day", () => {
    const rows: ComponentProps<typeof TimesheetTable>["rows"] = [{
      id: "staff-id", displayName: "Inactive Sam", status: "INACTIVE",
      shifts: [
        { id: "completed", clockIn: "2026-01-04T16:00:00Z", clockOut: "2026-01-05T00:00:00Z", updatedAt: "2026-01-05T00:00:00Z", edited: true, audits: [] },
        { id: "open", clockIn: "2026-01-05T16:00:00Z", clockOut: null, updatedAt: "2026-01-05T16:00:00Z", edited: false, audits: [] },
        { id: "overnight", clockIn: "2026-01-08T14:00:00Z", clockOut: "2026-01-08T22:00:00Z", updatedAt: "2026-01-08T22:00:00Z", edited: false, audits: [] },
        { id: "weekend", clockIn: "2026-01-11T14:00:00Z", clockOut: "2026-01-11T22:00:00Z", updatedAt: "2026-01-11T22:00:00Z", edited: false, audits: [] },
      ],
    }];
    const html = renderToStaticMarkup(createElement(TimesheetTable, {
      rows, staff: [{ id: "staff-id", displayName: "Inactive Sam" }], week: "2026-01-05", now: "2026-01-12T00:00:00Z",
    }));
    expect(html).toContain("16h 0m");
    expect(html).not.toContain("(16.00)");
    expect(html).toContain("Missing clock-out");
    expect(html).toContain("Inactive");
    expect(html).toContain("Edited");
    expect(html).toContain("(+1 day)");
    expect(html).toContain("22:00");
    expect(html).toContain("06:00");
    expect(html).not.toContain("aria-label=\"Add shift for");
    expect(html).not.toContain("Apply filters");
    expect(html).not.toContain(">Open<");
    expect(html).not.toContain("Sat,");
    expect(html).not.toContain("Sun,");
    expect(html).toContain("weekend shift(s) are saved but excluded");
    expect(html).toContain("role=\"switch\"");
    expect(html).toContain(" · ");
    expect(html).not.toContain("NaN");
  });

  it("offers Add shift when there are no rows", () => {
    const html = renderToStaticMarkup(createElement(TimesheetTable, {
      rows: [], staff: [{ id: "id", displayName: "No shifts" }], week: "2026-01-05", now: "2026-01-12T00:00:00Z",
    }));
    expect(html).toContain("+ Add shift");
    expect(html).toContain("No shifts match");
  });

  it("marks Western Australia public holidays in weekday headers", () => {
    const html = renderToStaticMarkup(createElement(TimesheetTable, {
      rows: [], staff: [], week: "2026-06-01", now: "2026-06-01T00:00:00Z",
    }));
    expect(html).toContain("Western Australia Day");
    expect(html).toContain("Public holiday");
  });
});
