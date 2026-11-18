import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { perthLocalToDate, shiftMinutes, toPerthLocal } from "@leave/lib/timesheets";

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => jar.has(name) ? { value: jar.get(name) } : undefined,
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));

let db: PGlite;
let socket: PGLiteSocketServer;
let prisma: PrismaClient;
let clockOut: typeof import("@leave/app/api/admin/timesheets/clock-out/route").POST;
let edit: typeof import("@leave/app/api/admin/timesheets/edit/route").POST;
let add: typeof import("@leave/app/api/admin/timesheets/add/route").POST;
let createAdminSession: typeof import("@leave/lib/session").createAdminSession;
let createStaffSession: typeof import("@leave/lib/session").createStaffSession;
let adminId: string;
let staffId: string;
const originalUrl = process.env.DATABASE_URL;
const at = perthLocalToDate;
const reason = "Confirmed with staff";
const request = (body: unknown) => new Request("http://localhost/api/admin/timesheets", {
  method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost" }, body: JSON.stringify(body),
});

beforeAll(async () => {
  db = await PGlite.create();
  const root = new URL("../packages/database/prisma/migrations/", import.meta.url);
  for (const folder of (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    await db.exec(await readFile(new URL(`${folder.name}/migration.sql`, root), "utf8"));
  }
  socket = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
  await socket.start();
  process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?connection_limit=1&sslmode=disable`;
  ({ prisma } = await import("@kenji/database"));
  ({ createAdminSession, createStaffSession } = await import("@leave/lib/session"));
  ({ POST: clockOut } = await import("@leave/app/api/admin/timesheets/clock-out/route"));
  ({ POST: edit } = await import("@leave/app/api/admin/timesheets/edit/route"));
  ({ POST: add } = await import("@leave/app/api/admin/timesheets/add/route"));
  await prisma.$connect();
}, 30000);

beforeEach(async () => {
  jar.clear();
  await prisma.staffSession.deleteMany();
  await prisma.shiftAudit.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.user.deleteMany();
  const admin = await prisma.user.create({ data: { displayName: "Admin", legalName: "Admin", pinHash: "test", passwordHash: "test-password-hash", role: "ADMIN", status: "ACTIVE" } });
  const staff = await prisma.user.create({ data: { displayName: "Sam", legalName: "Sam", pinHash: "test", role: "STAFF", status: "ACTIVE" } });
  adminId = admin.id; staffId = staff.id;
  await createAdminSession(adminId, "test-password-hash");
});

afterAll(async () => {
  await prisma?.$disconnect();
  await socket?.stop();
  await db?.close();
  vi.unstubAllEnvs();
  if (originalUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalUrl;
});

const makeShift = (start = "2026-01-05T08:00", end: string | null = null, userId = staffId) =>
  prisma.shift.create({ data: { userId, clockIn: at(start), clockOut: end ? at(end) : null, clockInRequestId: crypto.randomUUID() } });
const addInput = () => ({
  userId: staffId, date: "2026-01-05", startTime: "08:00", endTime: "16:00", reason, requestId: crypto.randomUUID(),
});

describe("timesheet route authorization", () => {
  it.each(["anonymous", "staff", "inactive admin"])("all routes reject %s", async state => {
    if (state === "anonymous") jar.clear();
    if (state === "staff") {
      jar.clear();
      await createStaffSession(staffId, "test");
    }
    if (state === "inactive admin") await prisma.user.update({ where: { id: adminId }, data: { status: "INACTIVE" } });
    for (const handler of [clockOut, edit, add]) {
      const response = await handler(request({}));
      expect(response.status).toBe(401);
    }
    expect(await prisma.shiftAudit.count()).toBe(0);
  });
});

describe("set clock-out", () => {
  it("persists one atomic audit and marks edited, then rejects a repeated close", async () => {
    const shift = await makeShift();
    const input = { shiftId: shift.id, clockOut: "2026-01-05T16:00", reason };
    const response = await clockOut(request(input));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true });
    const saved = await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } });
    expect(saved.clockOut).toEqual(at(input.clockOut));
    expect(saved.edited).toBe(true);
    const audit = await prisma.shiftAudit.findFirstOrThrow();
    expect(audit).toMatchObject({
      actorId: adminId, shiftId: shift.id, action: "SET_CLOCK_OUT", reason,
      before: { clockIn: shift.clockIn.toISOString(), clockOut: null },
      after: { clockIn: shift.clockIn.toISOString(), clockOut: at(input.clockOut).toISOString() },
    });
    expect((await clockOut(request(input))).status).toBe(409);
    expect(await prisma.shiftAudit.count()).toBe(1);
  });

  it.each(["2026-01-05T07:59", "2026-01-05T08:00", "2026-01-06T00:01"])("rejects invalid end %s without writes", async end => {
    const shift = await makeShift();
    expect((await clockOut(request({ shiftId: shift.id, clockOut: end, reason }))).status).toBe(400);
    expect((await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } })).clockOut).toBeNull();
    expect(await prisma.shiftAudit.count()).toBe(0);
  });

  it("rejects a clock-out later than database time", async () => {
    const [{ now }] = await prisma.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
    const start = new Date(now.getTime() - 3600000);
    const shift = await prisma.shift.create({ data: { userId: staffId, clockIn: start, clockInRequestId: crypto.randomUUID() } });
    const response = await clockOut(request({ shiftId: shift.id, clockOut: toPerthLocal(new Date(now.getTime() + 3600000)), reason }));
    expect(response.status).toBe(400);
  });

  it("accepts exactly 16 hours and rejects overlap with another completed shift", async () => {
    const shift = await makeShift();
    await makeShift("2026-01-05T20:00", "2026-01-05T21:00");
    const response = await clockOut(request({ shiftId: shift.id, clockOut: "2026-01-06T00:00", reason }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("overlaps Sam");
    await prisma.shift.deleteMany({ where: { id: { not: shift.id } } });
    expect((await clockOut(request({ shiftId: shift.id, clockOut: "2026-01-06T00:00", reason }))).status).toBe(200);
  });
});

describe("edit completed times", () => {
  it("updates both timestamps with an audit and rejects stale updates", async () => {
    const shift = await makeShift("2026-01-05T08:00", "2026-01-05T16:00");
    const input = { shiftId: shift.id, clockIn: "2026-01-05T09:00", clockOut: "2026-01-05T17:00", expectedUpdatedAt: shift.updatedAt.toISOString(), reason };
    expect((await edit(request(input))).status).toBe(200);
    expect((await prisma.shiftAudit.findFirstOrThrow()).action).toBe("EDIT_TIMES");
    expect((await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } })).clockIn).toEqual(at(input.clockIn));
    expect((await edit(request(input))).status).toBe(409);
    expect(await prisma.shiftAudit.count()).toBe(1);
  });

  it("rejects overlap, including an open shift, but allows touching boundaries", async () => {
    const shift = await makeShift("2026-01-05T08:00", "2026-01-05T12:00");
    await makeShift("2026-01-05T13:00");
    const input = { shiftId: shift.id, clockIn: "2026-01-05T08:00", clockOut: "2026-01-05T14:00", expectedUpdatedAt: shift.updatedAt.toISOString(), reason };
    expect((await edit(request(input))).status).toBe(409);
    expect((await edit(request({ ...input, clockOut: "2026-01-05T13:00" }))).status).toBe(200);
  });

  it("rejects reversed, future and overlong times", async () => {
    const shift = await makeShift("2026-01-05T08:00", "2026-01-05T12:00");
    const base = { shiftId: shift.id, clockIn: "2026-01-05T08:00", clockOut: "2026-01-05T07:00", expectedUpdatedAt: shift.updatedAt.toISOString(), reason };
    for (const input of [base, { ...base, clockOut: "2026-01-06T00:01" }, { ...base, clockIn: "2099-01-05T08:00", clockOut: "2099-01-05T09:00" }]) {
      expect((await edit(request(input))).status).toBe(400);
    }
    expect(await prisma.shiftAudit.count()).toBe(0);
  });
});

describe("add missed shifts", () => {
  it("adds an edited shift with null before history and deduplicates repeat and concurrent submits", async () => {
    const input = addInput();
    const responses = await Promise.all([add(request(input)), add(request(input))]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    expect(await prisma.shift.count()).toBe(1);
    expect(await prisma.shiftAudit.count()).toBe(1);
    expect(await prisma.shift.findFirstOrThrow()).toMatchObject({ edited: true, clockInRequestId: input.requestId });
    expect(await prisma.shiftAudit.findFirstOrThrow()).toMatchObject({ action: "ADD_SHIFT", before: null, actorId: adminId, reason });
    expect((await add(request(input))).status).toBe(200);
    expect(await prisma.shiftAudit.count()).toBe(1);
  });

  it("adds an overnight shift for inactive staff and associates it with clock-in week", async () => {
    await prisma.user.update({ where: { id: staffId }, data: { status: "INACTIVE" } });
    expect((await add(request({ ...addInput(), date: "2026-01-11", startTime: "22:00", endTime: "06:00" }))).status).toBe(200);
    const shift = await prisma.shift.findFirstOrThrow();
    expect(toPerthLocal(shift.clockIn)).toBe("2026-01-11T22:00");
    expect(toPerthLocal(shift.clockOut!)).toBe("2026-01-12T06:00");
    expect(shiftMinutes(shift.clockIn, shift.clockOut)).toBe(480);
  });

  it("rejects overlaps, other users' request IDs, pending staff and admins", async () => {
    const input = addInput();
    expect((await add(request(input))).status).toBe(200);
    expect((await add(request({ ...input, requestId: crypto.randomUUID() }))).status).toBe(409);
    const other = await prisma.user.create({ data: { displayName: "Other", legalName: "Other", pinHash: "test", status: "ACTIVE" } });
    expect((await add(request({ ...input, userId: other.id }))).status).toBe(409);
    await prisma.user.update({ where: { id: other.id }, data: { status: "PENDING" } });
    expect((await add(request({ ...addInput(), userId: other.id }))).status).toBe(400);
    expect((await add(request({ ...addInput(), userId: adminId }))).status).toBe(400);
  });

  it("rejects equal start/end, future, overlong shifts and short reasons", async () => {
    const base = addInput();
    for (const invalid of [{ endTime: "08:00" }, { endTime: "01:00" }, { date: "2099-01-05" }]) {
      expect((await add(request({ ...base, ...invalid }))).status).toBe(400);
    }
    expect((await add(request({ ...base, reason: "x" }))).status).toBe(400);
    expect(await prisma.shift.count()).toBe(0);
  });
});

describe("atomic correction history", () => {
  it("rolls back updates and inserts if writing the audit fails", async () => {
    await db.exec(`ALTER TABLE "ShiftAudit" ADD CONSTRAINT "test_reason" CHECK ("reason" <> 'Force rollback')`);
    const shift = await makeShift();
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await clockOut(request({ shiftId: shift.id, clockOut: "2026-01-05T16:00", reason: "Force rollback" }))).status).toBe(503);
      const saved = await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } });
      expect(saved.clockOut).toBeNull();
      expect(saved.edited).toBe(false);
      expect(saved.updatedAt).toEqual(shift.updatedAt);
      expect((await add(request({ ...addInput(), date: "2026-01-04", reason: "Force rollback" }))).status).toBe(503);
      expect(await prisma.shift.count()).toBe(1);
      expect(await prisma.shiftAudit.count()).toBe(0);
    } finally {
      errorLog.mockRestore();
      await db.exec(`ALTER TABLE "ShiftAudit" DROP CONSTRAINT "test_reason"`);
    }
  });
});
