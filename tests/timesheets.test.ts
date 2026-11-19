import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addedShiftTimes, formatHours, missingClockOut, parseWeekParam, perthLocalToDate,
  perthWeekStart, shiftMinutes, toPerthLocal,
} from "@leave/lib/timesheets";
import { timesheetAddSchema, timesheetClockOutSchema } from "@leave/lib/contracts";

afterEach(() => vi.useRealTimers());

describe("Perth timesheets", () => {
  it.each([
    ["2026-11-16T00:00:00+08:00", "2026-11-15T16:00:00.000Z"],
    ["2026-11-22T23:59:00+08:00", "2026-11-15T16:00:00.000Z"],
    ["2026-11-22T17:00:00Z", "2026-11-22T16:00:00.000Z"],
    ["2026-11-22T15:59:00Z", "2026-11-15T16:00:00.000Z"],
  ])("snaps %s to Perth Monday", (input, expected) => {
    expect(perthWeekStart(new Date(input)).toISOString()).toBe(expected);
  });

  it("uses the current week for missing/invalid dates and snaps valid dates to Monday", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-11-17T04:00:00Z"));
    for (const input of [undefined, "", "invalid", "2026-02-30", "2026-13-01", "2026-1-2"]) {
      expect(parseWeekParam(input).toISOString()).toBe("2026-11-15T16:00:00.000Z");
    }
    expect(toPerthLocal(parseWeekParam("2026-11-22"))).toBe("2026-11-16T00:00");
  });

  it("converts local times strictly and preserves overnight clock-in day/week", () => {
    const start = perthLocalToDate("2026-11-22T23:30");
    expect(start.toISOString()).toBe("2026-11-22T15:30:00.000Z");
    expect(toPerthLocal(start)).toBe("2026-11-22T23:30");
    expect(() => perthLocalToDate("2026-02-30T12:00")).toThrow();
    expect(() => perthLocalToDate("2026-11-22T24:00")).toThrow();
    expect(() => perthLocalToDate("2026-11-22T12:00Z")).toThrow();
    const shift = addedShiftTimes("2026-11-22", "23:30", "07:00");
    expect(toPerthLocal(shift.clockOut)).toBe("2026-11-23T07:00");
    expect(toPerthLocal(perthWeekStart(shift.clockIn))).toBe("2026-11-16T00:00");
    expect(shiftMinutes(shift.clockIn, shift.clockOut)).toBe(450);
    expect(addedShiftTimes("2026-12-31", "22:00", "06:00").clockOut.toISOString()).toBe("2026-12-31T22:00:00.000Z");
    const equal = addedShiftTimes("2026-11-20", "08:00", "08:00");
    expect(shiftMinutes(equal.clockIn, equal.clockOut)).toBe(1440);
  });

  it("rounds minutes down, ignores open shifts, and formats decimal hours", () => {
    const start = new Date("2026-11-01T00:00Z");
    expect(shiftMinutes(start, new Date("2026-11-01T07:36:59Z"))).toBe(456);
    expect(shiftMinutes(start, new Date("2026-10-31T00:00Z"))).toBe(0);
    expect(shiftMinutes(start, null)).toBe(0);
    expect(formatHours(456)).toBe("7h 36m");
  });

  it("flags missing clock-out at exactly 16 hours, not before or on completed shifts", () => {
    const start = new Date("2026-11-01T00:00Z");
    expect(missingClockOut(start, null, new Date("2026-11-01T15:59:59Z"))).toBe(false);
    expect(missingClockOut(start, null, new Date("2026-11-01T16:00:00Z"))).toBe(true);
    expect(missingClockOut(start, new Date("2026-11-01T01:00Z"), new Date("2026-11-03T00:00Z"))).toBe(false);
  });

  it("validates calendar dates, reasons and time shapes at the API boundary", () => {
    expect(timesheetClockOutSchema.safeParse({ shiftId: "id", clockOut: "2026-02-30T12:00", reason: "Test reason" }).success).toBe(false);
    const input = { userId: "id", date: "2026-11-16", startTime: "08:00", endTime: "16:00", reason: "Confirmed", requestId: crypto.randomUUID() };
    expect(timesheetAddSchema.safeParse(input).success).toBe(true);
    for (const invalid of [{ date: "2026-02-30" }, { startTime: "25:00" }, { reason: "x".repeat(501) }, { requestId: "not-a-uuid" }]) {
      expect(timesheetAddSchema.safeParse({ ...input, ...invalid }).success).toBe(false);
    }
  });
});
