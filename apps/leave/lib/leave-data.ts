import { Prisma } from "@prisma/client";
import { prisma } from "@kenji/database";
import { monthWindow, type CalendarLeave, type LeaveStatus, type PrivateLeave } from "./leave";

const calendarSelect = {
  id: true, allDay: true, startsAt: true, endsAt: true, returnDate: true, returnTime: true,
  user: { select: { displayName: true } },
} satisfies Prisma.LeaveRequestSelect;
const privateSelect = {
  ...calendarSelect, type: true, status: true, reason: true, version: true,
  createdAt: true, decisionNote: true, decidedAt: true, reviewer: { select: { displayName: true } },
  events: {
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, action: true, createdAt: true, note: true, actor: { select: { displayName: true } } },
  },
} satisfies Prisma.LeaveRequestSelect;

function calendarDto(leave: Prisma.LeaveRequestGetPayload<{ select: typeof calendarSelect }>): CalendarLeave {
  return {
    id: leave.id, name: leave.user.displayName, allDay: leave.allDay,
    startsAt: leave.startsAt.toISOString(), endsAt: leave.endsAt.toISOString(),
    returnDate: leave.returnDate.toISOString().slice(0, 10), returnTime: leave.returnTime,
  };
}
 
/** How many of this staff member's own requests are still waiting for a decision. */
export function pendingCount(userId: string) {
  return prisma.leaveRequest.count({ where: { userId, status: "PENDING" } });
}

export async function approvedCalendar(month: string) {
  const { start, end } = monthWindow(month);
  const requests = await prisma.leaveRequest.findMany({
    where: { status: "APPROVED", startsAt: { lt: end }, endsAt: { gt: start } },
    select: calendarSelect, orderBy: [{ startsAt: "asc" }, { id: "asc" }],
  });
  return requests.map(calendarDto);
}

export async function privateRequests(options: { staffId?: string; status?: LeaveStatus; page: number }) {
  const pageSize = 12;
  const where: Prisma.LeaveRequestWhereInput = {
    ...(options.staffId ? { userId: options.staffId } : {}),
    ...(options.status ? { status: options.status } : {}),
  };
  const count = await prisma.leaveRequest.count({ where });
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const page = Math.min(options.page, pages);
  const requests = await prisma.leaveRequest.findMany({
    where, select: privateSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize, take: pageSize,
  });
  const rows: PrivateLeave[] = requests.map(leave => ({
    ...calendarDto(leave), type: leave.type, status: leave.status,
    reason: leave.reason, version: leave.version, createdAt: leave.createdAt.toISOString(),
    decisionNote: leave.decisionNote, reviewer: leave.reviewer?.displayName ?? null,
    decidedAt: leave.decidedAt?.toISOString() ?? null,
    events: leave.events.map(event => ({
      id: event.id, action: event.action, actor: event.actor.displayName,
      note: event.note, createdAt: event.createdAt.toISOString(),
    })),
  }));
  return { rows, count, pages, page };
}
 