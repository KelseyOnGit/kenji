import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, tx } = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    user: { findUnique: vi.fn() },
    shift: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  };
  const db = {
    $queryRaw: vi.fn(),
    user: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  return { db, tx };
});

vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { POST as register } from "@/app/api/register/route";
import { GET as staff } from "@/app/api/staff/route";
import { POST as punch } from "@/app/api/punch/route";

function post(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

const userId = "staff-one";
const shiftId = "shift-one";
const requestId = "4457ae76-b1d5-4eb6-84cd-9bb7ad158385";
const startedAt = new Date("2026-11-11T01:00:00.000Z");
const endedAt = new Date("2026-11-11T09:00:00.000Z");
const pinHash = await bcrypt.hash("0123", 10);
const activeUser = { id: userId, displayName: "Test Staff", pinHash, status: "ACTIVE", role: "STAFF" };
const openShift = { id: shiftId, userId, clockIn: startedAt, clockOut: null, clockInRequestId: requestId, clockOutRequestId: null };
const clockInInput = { userId, pin: "0123", action: "CLOCK_IN", expectedShiftId: null, requestId };

beforeEach(() => {
  vi.clearAllMocks();
  db.user.create.mockReset().mockResolvedValue({ id: userId });
  db.user.findMany.mockReset().mockResolvedValue([]);
  db.$queryRaw.mockReset().mockResolvedValue([]);
  db.user.findUnique.mockReset().mockResolvedValue(activeUser);
  tx.user.findUnique.mockReset().mockResolvedValue(activeUser);
  tx.shift.findFirst.mockReset().mockResolvedValue(null);
  tx.shift.create.mockReset().mockResolvedValue(openShift);
  tx.shift.update.mockReset().mockResolvedValue({ ...openShift, clockOut: endedAt, clockOutRequestId: requestId });
  tx.$queryRaw.mockReset().mockResolvedValue([{ now: endedAt }]);
});

describe("POST /api/register", () => {
  it("hashes the exact four-digit PIN with cost 10 and creates only a pending staff account", async () => {
    const response = await register(post("/api/register", {
      fullName: "  Test   Staff  ", displayName: " ", contactNumber: "", email: "", pin: "0123",
    }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ status: "PENDING" });
    const data = db.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ legalName: "Test Staff", displayName: "Test Staff", role: "STAFF", status: "PENDING" });
    expect(data.pinHash).not.toBe("0123");
    expect(bcrypt.getRounds(data.pinHash)).toBe(10);
    expect(await bcrypt.compare("0123", data.pinHash)).toBe(true);
    expect(await bcrypt.compare("1230", data.pinHash)).toBe(false);
    expect(data).not.toHaveProperty("pin");
    expect(data.email).toBeUndefined();
  });

  it("normalizes optional profile fields", async () => {
    await register(post("/api/register", {
      fullName: "Test Staff", displayName: "Test Person", pin: "0123",
      email: " TEST@EXAMPLE.COM ", contactNumber: " +61 400 000 000 ",
    }));
    expect(db.user.create.mock.calls[0][0].data).toMatchObject({
      displayName: "Test Person", email: "test@example.com", contactNumber: "+61 400 000 000",
    });
  });

  it.each([
    { fullName: "", pin: "0123" },
    { fullName: "Test Staff", pin: 1234 },
    { fullName: "Test Staff", pin: "123" },
    { fullName: "Test Staff", pin: "12345" },
    { fullName: "Test Staff", pin: "abcd" },
    { fullName: "Test Staff", pin: "0123", email: "invalid" },
    { fullName: "Test Staff", pin: "0123", role: "ADMIN" },
    { fullName: "Test Staff", pin: "0123", status: "ACTIVE" },
  ])("rejects invalid input and privilege fields: %j", async (input) => {
    expect((await register(post("/api/register", input))).status).toBe(400);
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("rejects cross-origin submissions", async () => {
    const request = post("/api/register", { fullName: "Test Staff", pin: "0123" });
    request.headers.set("origin", "https://other.example");
    expect((await register(request)).status).toBe(403);
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("rejects malformed, oversized, and non-JSON bodies", async () => {
    const malformed = new Request("http://localhost/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    expect((await register(malformed)).status).toBe(400);
    expect((await register(post("/api/register", { fullName: "x".repeat(9000), pin: "0123" }))).status).toBe(413);
    const nonJson = new Request("http://localhost/api/register", { method: "POST", body: "text" });
    expect((await register(nonJson)).status).toBe(415);
  });

  it("reports an already registered email", async () => {
    db.user.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "6" }));
    expect((await register(post("/api/register", { fullName: "Test Staff", pin: "0123" }))).status).toBe(409);
  });

  it("reports database failures without exposing sensitive error details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      db.user.create.mockRejectedValue(new Error("private connection string"));
      const response = await register(post("/api/register", { fullName: "Test Staff", pin: "0123" }));
      expect(response.status).toBe(503);
      expect(JSON.stringify(await response.json())).not.toContain("private");
      expect(JSON.stringify(log.mock.calls)).not.toContain("private");
    } finally {
      log.mockRestore();
    }
  });
});

describe("GET /api/staff", () => {
  it("does not list all staff for an empty query", async () => {
    expect(await (await staff(new Request("http://localhost/api/staff?q="))).json()).toEqual({ staff: [], hasMore: false });
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("searches only active staff by full/display name and returns minimal public fields", async () => {
    db.$queryRaw.mockResolvedValue([{ id: userId, displayName: "Test Staff", shiftId, clockIn: startedAt }]);
    const response = await staff(new Request("http://localhost/api/staff?q=TeSt"));
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      staff: [{ id: userId, displayName: "Test Staff", currentShift: { id: shiftId, clockIn: startedAt.toISOString() } }],
      hasMore: false,
    });
    const sql = db.$queryRaw.mock.calls[0][0].join("");
    expect(sql).toContain('"status" = \'ACTIVE\'');
    expect(sql).toContain('"role" = \'STAFF\'');
    expect(sql).toContain("starts_with");
    expect(sql).not.toContain("pinHash");
    expect(sql).not.toContain("email");
  });

  it("caps results and signals that the search should be narrowed", async () => {
    db.$queryRaw.mockResolvedValue(Array.from({ length: 21 }, (_, index) => ({ id: String(index), displayName: "Test Staff", shiftId: null, clockIn: null })));
    const body = await (await staff(new Request("http://localhost/api/staff?q=test"))).json();
    expect(body.staff).toHaveLength(20);
    expect(body.hasMore).toBe(true);
  });
});

describe("POST /api/punch", () => {
  it("uses bcrypt comparison and rejects the wrong PIN without a transaction", async () => {
    expect((await punch(post("/api/punch", { ...clockInInput, pin: "9999" }))).status).toBe(401);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it.each(["PENDING", "INACTIVE"])("rejects %s staff even with a correct PIN", async (status) => {
    db.user.findUnique.mockResolvedValue({ ...activeUser, status });
    expect((await punch(post("/api/punch", clockInInput))).status).toBe(403);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects admin profiles and missing users", async () => {
    db.user.findUnique.mockResolvedValueOnce({ ...activeUser, role: "ADMIN" }).mockResolvedValueOnce(null);
    expect((await punch(post("/api/punch", clockInInput))).status).toBe(403);
    expect((await punch(post("/api/punch", clockInInput))).status).toBe(403);
  });

  it("locks the user row, rechecks approval and starts a shift with the database default time", async () => {
    const response = await punch(post("/api/punch", clockInInput));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ action: "CLOCK_IN", displayName: "Test Staff", occurredAt: startedAt.toISOString() });
    expect(tx.$queryRaw.mock.calls[0][0].join("")).toContain("FOR UPDATE");
    expect(tx.shift.create).toHaveBeenCalledWith({ data: { userId, clockInRequestId: requestId } });
  });

  it("does not write if approval or PIN changed while authenticating", async () => {
    tx.user.findUnique.mockResolvedValue({ ...activeUser, status: "INACTIVE" });
    expect((await punch(post("/api/punch", clockInInput))).status).toBe(403);
    tx.user.findUnique.mockResolvedValue({ ...activeUser, pinHash: "changed" });
    expect((await punch(post("/api/punch", clockInInput))).status).toBe(403);
    expect(tx.shift.create).not.toHaveBeenCalled();
  });

  it("replays the same request without creating a duplicate shift", async () => {
    tx.shift.findFirst.mockResolvedValueOnce(openShift);
    const response = await punch(post("/api/punch", clockInInput));
    expect(response.status).toBe(200);
    expect(tx.shift.create).not.toHaveBeenCalled();
    expect(tx.shift.update).not.toHaveBeenCalled();
  });

  it("rejects a repeated request ID belonging to another user/action", async () => {
    tx.shift.findFirst.mockResolvedValueOnce({ ...openShift, userId: "other-user" });
    expect((await punch(post("/api/punch", clockInInput))).status).toBe(409);
  });

  it("rejects stale shift state instead of toggling into an unintended action", async () => {
    tx.shift.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(openShift);
    expect((await punch(post("/api/punch", clockInInput))).status).toBe(409);
    expect(tx.shift.create).not.toHaveBeenCalled();
    expect(tx.shift.update).not.toHaveBeenCalled();
  });

  it("clocks out only the expected open shift with a database timestamp", async () => {
    tx.shift.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(openShift);
    const response = await punch(post("/api/punch", { ...clockInInput, action: "CLOCK_OUT", expectedShiftId: shiftId }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ action: "CLOCK_OUT", occurredAt: endedAt.toISOString() });
    expect(tx.shift.update).toHaveBeenCalledWith({ where: { id: shiftId }, data: { clockOut: endedAt, clockOutRequestId: requestId } });
  });

  it("rejects a clock-out with no open shift", async () => {
    expect((await punch(post("/api/punch", { ...clockInInput, action: "CLOCK_OUT", expectedShiftId: shiftId }))).status).toBe(409);
    expect(tx.shift.update).not.toHaveBeenCalled();
  });

  it("does not accept clock-out timestamps before clock-in", async () => {
    tx.shift.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...openShift, clockIn: new Date("2099-01-01") });
    expect((await punch(post("/api/punch", { ...clockInInput, action: "CLOCK_OUT", expectedShiftId: shiftId }))).status).toBe(409);
  });

  it.each([
    { ...clockInInput, pin: "12345" },
    { ...clockInInput, requestId: "invalid" },
    { ...clockInInput, action: "TOGGLE" },
    { ...clockInInput, action: "CLOCK_OUT" },
    { ...clockInInput, expectedShiftId: shiftId },
    { ...clockInInput, clockIn: "2000-01-01" },
  ])("rejects invalid punch fields: %j", async (input) => {
    expect((await punch(post("/api/punch", input))).status).toBe(400);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
