import { DAY_MS, perthDisplay, perthLocalToDate, toPerthLocal } from "./timesheets";

export const leaveTypes = {
  ANNUAL: "Annual leave", PERSONAL: "Personal leave", UNPAID: "Unpaid leave", OTHER: "Other",
} as const;
export const leaveStatuses = {
  PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", CANCELLED: "Cancelled",
} as const;
export type LeaveType = keyof typeof leaveTypes;
export type LeaveStatus = keyof typeof leaveStatuses;

export function validLeaveDate(value: string) {
  if (!/^(20\d{2}|21\d{2})-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function nextDate(value: string) {
  return new Date(new Date(`${value}T00:00:00Z`).getTime() + DAY_MS).toISOString().slice(0, 10);
}

export type LeaveFields = {
  type: LeaveType; allDay: boolean; startDate: string; endDate: string;
  startTime: string; endTime: string; returnDate: string; returnTime: string; reason: string;
};

export function leaveInterval(input: LeaveFields) {
  const startsAt = perthLocalToDate(`${input.startDate}T${input.allDay ? "00:00" : input.startTime}`);
  const endsAt = perthLocalToDate(input.allDay
    ? `${nextDate(input.endDate)}T00:00`
    : `${input.endDate}T${input.endTime}`);
  return { startsAt, endsAt };
}

export type CalendarLeave = {
  id: string; name: string; allDay: boolean; startsAt: string; endsAt: string;
  returnDate: string; returnTime: string | null;
};

export type PrivateLeave = CalendarLeave & {
  type: LeaveType; status: LeaveStatus; reason: string; version: number;
  createdAt: string; decisionNote: string | null; reviewer: string | null; decidedAt: string | null;
  events: { id: string; action: string; actor: string; createdAt: string; note: string | null }[];
};

export function leaveDates(leave: Pick<CalendarLeave, "allDay" | "startsAt" | "endsAt">) {
  return {
    startDate: toPerthLocal(new Date(leave.startsAt)).slice(0, 10),
    endDate: toPerthLocal(new Date(new Date(leave.endsAt).getTime() - (leave.allDay ? DAY_MS : 0))).slice(0, 10),
    startTime: leave.allDay ? "" : toPerthLocal(new Date(leave.startsAt)).slice(11),
    endTime: leave.allDay ? "" : toPerthLocal(new Date(leave.endsAt)).slice(11),
  };
}

export function displayLeaveDate(date: string) {
  return perthDisplay(perthLocalToDate(`${date}T00:00`), { day: "numeric", month: "short", year: "numeric" });
}



export function monthWindow(value?: string) {
  const month = value && validLeaveDate(`${value}-01`) ? value : toPerthLocal(new Date()).slice(0, 7);
  const start = perthLocalToDate(`${month}-01T00:00`);
  const next = new Date(`${month}-01T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const end = perthLocalToDate(`${next.toISOString().slice(0, 10)}T00:00`);
  const previous = new Date(`${month}-01T00:00:00Z`);
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  return {
    month, start, end, previous: previous.toISOString().slice(0, 7), next: next.toISOString().slice(0, 7),
    label: perthDisplay(start, { month: "long", year: "numeric" }),
    days: Math.round((end.getTime() - start.getTime()) / DAY_MS),
    offset: (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7,
  };
}
