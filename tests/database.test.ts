import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let database: PGlite;
let server: PGLiteSocketServer;
let prisma: PrismaClient;
let register: typeof import("@/app/api/register/route").POST;
let search: typeof import("@/app/api/staff/route").GET;
let punch: typeof import("@/app/api/punch/route").POST;
const originalUrl = process.env.DATABASE_URL;

function request(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  database = await PGlite.create();
  await database.exec(await readFile(new URL("../prisma/migrations/20261111040000_initial_registration_kiosk/migration.sql", import.meta.url), "utf8"));
  server = new PGLiteSocketServer({ db: database, port: 0, host: "127.0.0.1" });
  await server.start();
  process.env.DATABASE_URL = `postgresql://postgres:postgres@${server.getServerConn()}/postgres?connection_limit=1&sslmode=disable`;
  ({ prisma } = await import("@/lib/prisma"));
  ({ POST: register } = await import("@/app/api/register/route"));
  ({ GET: search } = await import("@/app/api/staff/route"));
  ({ POST: punch } = await import("@/app/api/punch/route"));
  await prisma.$connect();
}, 30000);

beforeEach(async () => {
  await prisma.shift.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma?.$disconnect();
  await server?.stop();
  await database?.close();
  if (originalUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalUrl;
});

async function activeStaff() {
  return prisma.user.create({
    data: { displayName: "Integration Staff", legalName: "Integration Staff", pinHash: await bcrypt.hash("0123", 10), status: "ACTIVE" },
  });
}

describe("PostgreSQL migration and real Prisma route integration", () => {
  it("persists registration as pending with a hashed PIN and hides it until approval", async () => {
    const response = await register(request("/api/register", { fullName: "Integration Staff", pin: "0123" }));
    expect(response.status).toBe(201);
    const user = await prisma.user.findFirstOrThrow();
    expect(user.status).toBe("PENDING");
    expect(user.role).toBe("STAFF");
    expect(await bcrypt.compare("0123", user.pinHash)).toBe(true);
    expect((await (await search(new Request("http://localhost/api/staff?q=integration"))).json()).staff).toEqual([]);
    await prisma.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } });
    const results = await (await search(new Request("http://localhost/api/staff?q=INTE"))).json();
    expect(results.staff).toEqual([{ id: user.id, displayName: user.displayName, currentShift: null }]);
  });

  it("suggests from the first letter and narrows names by prefix", async () => {
    const hash = await bcrypt.hash("0123", 10);
    for (const displayName of ["Kelsey", "Kalven", "Kacey", "Mikayla"]) {
      await prisma.user.create({ data: { displayName, legalName: displayName, pinHash: hash, status: "ACTIVE" } });
    }
    const names = async (query: string) => {
      const body = await (await search(new Request(`http://localhost/api/staff?q=${encodeURIComponent(query)}`))).json();
      return body.staff.map((staff: { displayName: string }) => staff.displayName);
    };
    expect(await names("k")).toEqual(["Kacey", "Kalven", "Kelsey"]);
    expect(await names("KA")).toEqual(["Kacey", "Kalven"]);
    expect(await names("kel")).toEqual(["Kelsey"]);
    expect(await names("%")).toEqual([]);
    expect(await names("_")).toEqual([]);
    expect(await names("k' OR true --")).toEqual([]);
  });

  it("finds formatted phone prefixes without exposing phone numbers or including unapproved staff", async () => {
    const user = await activeStaff();
    await prisma.user.update({ where: { id: user.id }, data: { contactNumber: "+61 (400) 123-456" } });
    const lookup = async (query: string) => (await search(new Request(`http://localhost/api/staff?q=${encodeURIComponent(query)}`))).json();
    const result = await lookup("+61 400");
    expect(result.staff).toEqual([{ id: user.id, displayName: user.displayName, currentShift: null }]);
    expect(JSON.stringify(result)).not.toContain("contactNumber");
    expect((await lookup("61400123")).staff).toHaveLength(1);
    expect((await lookup("123456")).staff).toEqual([]);
    expect((await lookup("+")).staff).toEqual([]);
    await prisma.user.update({ where: { id: user.id }, data: { status: "PENDING" } });
    expect((await lookup("614")).staff).toEqual([]);
  });

  it("persists a complete shift and safely replays repeated clock-in and clock-out requests", async () => {
    const user = await activeStaff();
    const input = { userId: user.id, pin: "0123", action: "CLOCK_IN", expectedShiftId: null, requestId: crypto.randomUUID() };
    const first = await punch(request("/api/punch", input));
    expect(first.status).toBe(200);
    const replay = await punch(request("/api/punch", input));
    expect(await replay.json()).toEqual(await first.json());
    expect(await prisma.shift.count()).toBe(1);
    const shift = await prisma.shift.findFirstOrThrow();
    const out = { ...input, action: "CLOCK_OUT", expectedShiftId: shift.id, requestId: crypto.randomUUID() };
    const response = await punch(request("/api/punch", out));
    expect(response.status).toBe(200);
    expect(await (await punch(request("/api/punch", out))).json()).toEqual(await response.json());
    const saved = await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } });
    expect(saved.clockOut).toBeInstanceOf(Date);
    expect(saved.clockOut!.getTime()).toBeGreaterThanOrEqual(saved.clockIn.getTime());
    expect(await prisma.shift.count()).toBe(1);
    const stale = await punch(request("/api/punch", { ...out, requestId: crypto.randomUUID() }));
    expect(stale.status).toBe(409);
  });

  it("handles two simultaneous clock-in requests without creating two shifts", async () => {
    const user = await activeStaff();
    const input = { userId: user.id, pin: "0123", action: "CLOCK_IN", expectedShiftId: null };
    const responses = await Promise.all([
      punch(request("/api/punch", { ...input, requestId: crypto.randomUUID() })),
      punch(request("/api/punch", { ...input, requestId: crypto.randomUUID() })),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await prisma.shift.count()).toBe(1);
  });

  it("enforces one open shift and chronological timestamps in the database itself", async () => {
    const user = await activeStaff();
    await prisma.shift.create({ data: { userId: user.id, clockInRequestId: crypto.randomUUID() } });
    await expect(prisma.shift.create({ data: { userId: user.id, clockInRequestId: crypto.randomUUID() } })).rejects.toMatchObject({ code: "P2002" });
    await expect(prisma.shift.updateMany({ where: { userId: user.id }, data: { clockOut: new Date("2000-01-01") } })).rejects.toThrow();
  });

  it("does not save a shift with an incorrect PIN, even across repeated attempts", async () => {
    const user = await activeStaff();
    const input = { userId: user.id, pin: "9999", action: "CLOCK_IN", expectedShiftId: null, requestId: crypto.randomUUID() };
    for (let attempt = 0; attempt < 6; attempt++) {
      expect((await punch(request("/api/punch", input))).status).toBe(401);
    }
    expect(await prisma.shift.count()).toBe(0);
    expect((await punch(request("/api/punch", { ...input, pin: "0123" }))).status).toBe(200);
  });
});
