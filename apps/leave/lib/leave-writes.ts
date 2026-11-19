import { Prisma } from "@prisma/client";
import { prisma } from "@kenji/database";
import { ApiError } from "@kenji/web/api";
import { leaveInterval, type LeaveFields } from "./leave";
import { databaseNow, lockStaff } from "./timesheet-writes";
import { toPerthLocal } from "./timesheets";

type Tx = Prisma.TransactionClient;
export const leaveWriteSelect = {
  id: true, userId: true, type: true, status: true, allDay: true,
  startsAt: true, endsAt: true, returnDate: true, returnTime: true, reason: true,
  version: true, reviewerId: true, decisionNote: true, decidedAt: true,
} satisfies Prisma.LeaveRequestSelect;
type SavedLeave = Prisma.LeaveRequestGetPayload<{ select: typeof leaveWriteSelect }>;

const snapshot = (leave: SavedLeave) => ({
  ...leave, startsAt: leave.startsAt.toISOString(), endsAt: leave.endsAt.toISOString(),
  returnDate: leave.returnDate.toISOString().slice(0, 10), decidedAt: leave.decidedAt?.toISOString() ?? null,
});

async function event(tx: Tx, actorId: string, action: "SUBMITTED" | "UPDATED" | "CANCELLED" | "APPROVED" | "REJECTED",
  before: SavedLeave | null, after: SavedLeave, note?: string) {
  await tx.leaveEvent.create({ data: {
    leaveId: after.id, actorId, action,
    ...(before ? { before: snapshot(before) } : {}),
    after: snapshot(after), note: note || null,
  } });
}

async function noOverlap(tx: Tx, userId: string, startsAt: Date, endsAt: Date, excludeId?: string) {
  const overlap = await tx.leaveRequest.findFirst({
    where: {
      userId, status: { in: ["PENDING", "APPROVED"] },
      startsAt: { lt: endsAt }, endsAt: { gt: startsAt },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (overlap) throw new ApiError(409, "These dates overlap an existing pending or approved request. Review or cancel that request first.");
}

async function validatedData(tx: Tx, userId: string, input: LeaveFields, excludeId?: string) {
  const { startsAt, endsAt } = leaveInterval(input);
  const now = await databaseNow(tx);
  if (input.startDate < toPerthLocal(now).slice(0, 10) && input.type !== "PERSONAL") {
    throw new ApiError(400, "Only personal leave can start on a past date. Check your dates or leave type.");
  }
  await noOverlap(tx, userId, startsAt, endsAt, excludeId);
  return {
    type: input.type, allDay: input.allDay, startsAt, endsAt,
    returnDate: new Date(`${input.returnDate}T00:00:00Z`),
    returnTime: input.returnTime || null, reason: input.reason,
  };
}

async function currentRequest(tx: Tx, leaveId: string, expectedVersion: number) {
  const leave = await tx.leaveRequest.findUnique({ where: { id: leaveId }, select: leaveWriteSelect });
  if (!leave || leave.version !== expectedVersion) {
    throw new ApiError(409, "This request has changed. Refresh the page and review the latest details before trying again.");
  }
  return leave;
}

async function lockActiveStaff(tx: Tx, userId: string) {
  const user = await lockStaff(tx, userId);
  if (user.status !== "ACTIVE") throw new ApiError(403, "Your profile is no longer active. Please contact us.");
}

export async function createLeave(userId: string, input: LeaveFields & { requestId: string }) {
  await prisma.$transaction(async tx => {
    await lockActiveStaff(tx, userId);
    const existing = await tx.leaveRequest.findUnique({ where: { requestId: input.requestId }, select: { userId: true } });
    if (existing) {
      if (existing.userId !== userId) throw new ApiError(409, "This submission ID has already been used. Refresh the page and try again.");
      return;
    }
    const data = await validatedData(tx, userId, input);
    const leave = await tx.leaveRequest.create({
      data: { ...data, userId, requestId: input.requestId }, select: leaveWriteSelect,
    });
    await event(tx, userId, "SUBMITTED", null, leave);
  });
}

export async function editLeave(userId: string, input: LeaveFields & { leaveId: string; expectedVersion: number }) {
  await prisma.$transaction(async tx => {
    await lockActiveStaff(tx, userId);
    // Check ownership before stale-state checks so another person's request is never exposed.
    const owner = await tx.leaveRequest.findUnique({ where: { id: input.leaveId }, select: { userId: true } });
    if (!owner || owner.userId !== userId) throw new ApiError(404, "This request could not be found.");
    const before = await currentRequest(tx, input.leaveId, input.expectedVersion);
    if (before.status !== "PENDING") throw new ApiError(409, "Only pending requests can be edited. Cancel and submit a new request to change approved leave.");
    const data = await validatedData(tx, userId, input, before.id);
    const after = await tx.leaveRequest.update({
      where: { id: before.id }, data: { ...data, version: { increment: 1 } }, select: leaveWriteSelect,
    });
    await event(tx, userId, "UPDATED", before, after);
  });
}

export async function cancelLeave(userId: string, leaveId: string, expectedVersion: number) {
  await prisma.$transaction(async tx => {
    await lockActiveStaff(tx, userId);
    const owner = await tx.leaveRequest.findUnique({ where: { id: leaveId }, select: { userId: true } });
    if (!owner || owner.userId !== userId) throw new ApiError(404, "This request could not be found.");
    const before = await currentRequest(tx, leaveId, expectedVersion);
    if (!["PENDING", "APPROVED"].includes(before.status)) {
      throw new ApiError(409, "Only pending or approved requests can be cancelled. Refresh the page.");
    }
    const after = await tx.leaveRequest.update({
      where: { id: leaveId }, data: { status: "CANCELLED", version: { increment: 1 } }, select: leaveWriteSelect,
    });
    await event(tx, userId, "CANCELLED", before, after);
  });
}

export async function reviewLeave(adminId: string, input: {
  leaveId: string; expectedVersion: number; decision: "APPROVED" | "REJECTED"; note: string;
}) {
  const owner = await prisma.leaveRequest.findUnique({ where: { id: input.leaveId }, select: { userId: true } });
  if (!owner) throw new ApiError(404, "This request could not be found. Refresh the page.");
  await prisma.$transaction(async tx => {
    const staff = await lockStaff(tx, owner.userId);
    const before = await currentRequest(tx, input.leaveId, input.expectedVersion);
    if (before.status !== "PENDING") throw new ApiError(409, "This request is no longer pending. Refresh to see the latest decision.");
    if (input.decision === "APPROVED") {
      if (staff.status !== "ACTIVE") throw new ApiError(409, "This staff profile is inactive. Do not approve it; contact the staff member or reject the request.");
      await noOverlap(tx, owner.userId, before.startsAt, before.endsAt, before.id);
    }
    const after = await tx.leaveRequest.update({
      where: { id: before.id },
      data: {
        status: input.decision, reviewerId: adminId, decidedAt: await databaseNow(tx),
        decisionNote: input.note || null, version: { increment: 1 },
      },
      select: leaveWriteSelect,
    });
    await event(tx, adminId, input.decision, before, after, input.note);
  });
}
