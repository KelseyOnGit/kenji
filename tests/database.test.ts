import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const cookieJar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined,
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
}));

let database: PGlite;
let server: PGLiteSocketServer;
let prisma: PrismaClient;
let register: typeof import("@/app/api/register/route").POST;
let search: typeof import("@/app/api/staff/route").GET;
let punch: typeof import("@/app/api/punch/route").POST;
let staffLogin: typeof import("@leave/app/api/auth/login/route").POST;
let staffLogout: typeof import("@leave/app/api/auth/logout/route").POST;
let getStaff: typeof import("@leave/lib/session").getStaff;
let adminLogin: typeof import("@leave/app/api/admin/auth/login/route").POST;
let adminLogout: typeof import("@leave/app/api/admin/auth/logout/route").POST;
let getAdmin: typeof import("@leave/lib/session").getAdmin;
let requireAdmin: typeof import("@leave/lib/session").requireAdmin;
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
  await database.exec(await readFile(new URL("../packages/database/prisma/migrations/20261111040000_initial_registration_kiosk/migration.sql", import.meta.url), "utf8"));
  await database.exec(await readFile(new URL("../packages/database/prisma/migrations/20261116080000_staff_login/migration.sql", import.meta.url), "utf8"));
  server = new PGLiteSocketServer({ db: database, port: 0, host: "127.0.0.1" });
  await server.start();
  process.env.DATABASE_URL = `postgresql://postgres:postgres@${server.getServerConn()}/postgres?connection_limit=1&sslmode=disable`;
  ({ prisma } = await import("@/lib/prisma"));
  ({ POST: register } = await import("@/app/api/register/route"));
  ({ GET: search } = await import("@/app/api/staff/route"));
  ({ POST: punch } = await import("@/app/api/punch/route"));
  ({ POST: staffLogin } = await import("@leave/app/api/auth/login/route"));
  ({ POST: staffLogout } = await import("@leave/app/api/auth/logout/route"));
  ({ getStaff } = await import("@leave/lib/session"));
  ({ POST: adminLogin } = await import("@leave/app/api/admin/auth/login/route"));
  ({ POST: adminLogout } = await import("@leave/app/api/admin/auth/logout/route"));
  ({ getAdmin, requireAdmin } = await import("@leave/lib/session"));
  await prisma.$connect();
}, 30000);

beforeEach(async () => {
  vi.stubEnv("AUTO_APPROVE_STAFF", "false");
  cookieJar.clear();
  await prisma.staffSession.deleteMany();
  await prisma.staffLoginWindow.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.user.deleteMany();
});

describe("shared staff identity and leave login", () => {
  async function staffWithEmail() {
    const user = await activeStaff();
    return prisma.user.update({ where: { id: user.id }, data: { email: "staff@example.com" } });
  }
  const credentials = { email: "staff@example.com", pin: "0123" };
  const login = (body: unknown = credentials) => staffLogin(request("/api/auth/login", body));

  it("uses the timer's PIN and protects and deletes an opaque host-only staff session", async () => {
    expect(await getStaff()).toBeNull();
    const user = await staffWithEmail();
    expect((await login({ email: " STAFF@EXAMPLE.COM ", pin: "0123" })).status).toBe(200);
    expect(await getStaff()).toEqual({ id: user.id, displayName: user.displayName, email: user.email });
    const session = await prisma.staffSession.findFirstOrThrow();
    expect(session.tokenHash).not.toBe(cookieJar.get("kenji_leave_session"));
    expect(session.credentialDigest).not.toBe(user.pinHash);
    expect((await staffLogout(request("/api/auth/logout", {}))).status).toBe(200);
    expect(await getStaff()).toBeNull();
    expect(await prisma.staffSession.count()).toBe(0);
    expect(await prisma.user.count()).toBe(1);
  });

  describe("leave admin sign-in", () => {
    const credentials = { email: "admin@example.com", password: "admin-test-password" };
    const login = (body: unknown = credentials) => adminLogin(request("/api/admin/auth/login", body));
    async function adminAccount() {
      return prisma.user.create({
        data: {
          displayName: "Test Admin", legalName: "Test Admin",
          email: credentials.email, role: "ADMIN", status: "ACTIVE",
          pinHash: await bcrypt.hash("0123", 10),
          passwordHash: await bcrypt.hash(credentials.password, 10),
        },
      });
    }

    it("uses a separate password and opaque session and redirects unauthenticated admins", async () => {
      expect(await getAdmin()).toBeNull();
      await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT");
      const user = await adminAccount();
      expect((await login({ ...credentials, email: " ADMIN@EXAMPLE.COM " })).status).toBe(200);
      expect(await requireAdmin()).toEqual({ id: user.id, displayName: user.displayName, email: user.email });
      expect(cookieJar.has("kenji_leave_admin_session")).toBe(true);
      expect(cookieJar.has("kenji_leave_session")).toBe(false);
      expect(await getStaff()).toBeNull();
      const session = await prisma.staffSession.findFirstOrThrow();
      expect(session.tokenHash).not.toBe(cookieJar.get("kenji_leave_admin_session"));
      expect(session.credentialDigest).not.toBe(user.passwordHash);
      expect((await login({ ...credentials, password: "0123" })).status).toBe(401);
    });

    it.each(["PENDING", "INACTIVE", "STAFF", "missing", "no-password"])("rejects %s accounts without creating a session", async state => {
      const user = await adminAccount();
      if (state === "missing") await prisma.user.delete({ where: { id: user.id } });
      else if (state === "STAFF") await prisma.user.update({ where: { id: user.id }, data: { role: "STAFF" } });
      else if (state === "no-password") await prisma.user.update({ where: { id: user.id }, data: { passwordHash: null } });
      else await prisma.user.update({ where: { id: user.id }, data: { status: state as "PENDING" | "INACTIVE" } });
      const response = await login();
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: "Incorrect email or password, or this account does not have admin access. Please contact us if you need help.",
      });
      expect(await getAdmin()).toBeNull();
      expect(await prisma.staffSession.count()).toBe(0);
    });

    it("rejects incorrect passwords, malformed requests, and ambiguous case-insensitive emails", async () => {
      const user = await adminAccount();
      expect((await login({ ...credentials, password: "incorrect" })).status).toBe(401);
      expect((await login({ ...credentials, password: "" })).status).toBe(400);
      expect((await login({ ...credentials, role: "ADMIN" })).status).toBe(400);
      await prisma.user.create({
        data: {
          displayName: "Other", legalName: "Other", email: credentials.email.toUpperCase(),
          pinHash: user.pinHash, passwordHash: user.passwordHash, role: "ADMIN", status: "ACTIVE",
        },
      });
      expect((await login()).status).toBe(401);
      expect(await getAdmin()).toBeNull();
    });

    it("isolates staff and admin tokens and signs out only the admin session", async () => {
      await adminAccount();
      const staff = await activeStaff();
      await prisma.user.update({ where: { id: staff.id }, data: { email: "staff@example.com" } });
      await staffLogin(request("/api/auth/login", { email: "staff@example.com", pin: "0123" }));
      await login();
      const staffToken = cookieJar.get("kenji_leave_session")!;
      const adminToken = cookieJar.get("kenji_leave_admin_session")!;
      cookieJar.set("kenji_leave_admin_session", staffToken);
      expect(await getAdmin()).toBeNull();
      cookieJar.set("kenji_leave_admin_session", adminToken);
      cookieJar.set("kenji_leave_session", adminToken);
      expect(await getStaff()).toBeNull();
      cookieJar.set("kenji_leave_session", staffToken);
      expect((await adminLogout(request("/api/admin/auth/logout", {}))).status).toBe(200);
      expect(await getAdmin()).toBeNull();
      expect(await getStaff()).not.toBeNull();
      expect(await prisma.staffSession.count()).toBe(1);
      cookieJar.set("kenji_leave_admin_session", adminToken);
      expect(await getAdmin()).toBeNull();
    });

    it("revokes sessions on password, role, or status changes, but not admin PIN changes", async () => {
      const user = await adminAccount();
      await login();
      await prisma.user.update({ where: { id: user.id }, data: { pinHash: await bcrypt.hash("9999", 10) } });
      expect(await getAdmin()).not.toBeNull();
      const passwordHash = await bcrypt.hash("new-admin-password", 10);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
      expect(await getAdmin()).toBeNull();
      await login({ ...credentials, password: "new-admin-password" });
      await prisma.user.update({ where: { id: user.id }, data: { role: "STAFF" } });
      expect(await getAdmin()).toBeNull();
      await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN", status: "INACTIVE" } });
      expect(await getAdmin()).toBeNull();
    });

    it("rejects expired and tampered admin sessions", async () => {
      await adminAccount();
      await login();
      const token = cookieJar.get("kenji_leave_admin_session")!;
      cookieJar.set("kenji_leave_admin_session", "a".repeat(43));
      expect(await getAdmin()).toBeNull();
      cookieJar.set("kenji_leave_admin_session", token);
      await prisma.staffSession.updateMany({ data: { expiresAt: new Date("2000-01-01") } });
      expect(await getAdmin()).toBeNull();
    });

    it("limits admin attempts independently from staff attempts and reopens after expiry", async () => {
      await adminAccount();
      for (let attempt = 0; attempt < 5; attempt++) {
        expect((await login({ ...credentials, password: "incorrect" })).status).toBe(401);
      }
      const response = await login();
      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("900");
      expect((await staffLogin(request("/api/auth/login", { email: credentials.email, pin: "0123" }))).status).toBe(401);
      expect(await prisma.staffLoginWindow.count()).toBe(2);
      await prisma.staffLoginWindow.updateMany({ data: { expiresAt: new Date("2000-01-01") } });
      expect((await login()).status).toBe(200);
    });

    it("rejects cross-origin sign-in and sign-out without changing the session", async () => {
      await adminAccount();
      const externalRequest = (path: string, body: unknown) => new Request(`http://localhost${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://unrelated.example" },
        body: JSON.stringify(body),
      });
      expect((await adminLogin(externalRequest("/api/admin/auth/login", credentials))).status).toBe(403);
      expect(await prisma.staffLoginWindow.count()).toBe(0);
      await login();
      expect((await adminLogout(externalRequest("/api/admin/auth/logout", {}))).status).toBe(403);
      expect(await getAdmin()).not.toBeNull();
    });
  });

  it("shares PIN changes across apps and invalidates earlier sessions", async () => {
    const user = await staffWithEmail();
    expect((await login()).status).toBe(200);
    await prisma.user.update({ where: { id: user.id }, data: { pinHash: await bcrypt.hash("5432", 10) } });
    expect(await getStaff()).toBeNull();
    expect((await login()).status).toBe(401);
    expect((await login({ ...credentials, pin: "5432" })).status).toBe(200);
    const input = { userId: user.id, pin: "5432", action: "CLOCK_IN", expectedShiftId: null, requestId: crypto.randomUUID() };
    expect((await punch(request("/api/punch", input))).status).toBe(200);
  });

  it.each(["PENDING", "INACTIVE", "ADMIN", "missing"])("rejects %s accounts with the same generic response", async (state) => {
    const user = await staffWithEmail();
    if (state === "missing") await prisma.user.delete({ where: { id: user.id } });
    else if (state === "ADMIN") await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    else await prisma.user.update({ where: { id: user.id }, data: { status: state as "PENDING" | "INACTIVE" } });
    const response = await login();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Incorrect email or PIN, or your profile is not active. Please contact us if you need help." });
    expect(await prisma.staffSession.count()).toBe(0);
  });

  it("rejects invalid PINs and malformed credentials without granting access", async () => {
    await staffWithEmail();
    expect((await login({ ...credentials, pin: "9999" })).status).toBe(401);
    expect((await login({ ...credentials, pin: "123" })).status).toBe(400);
    expect((await login({ ...credentials, role: "ADMIN" })).status).toBe(400);
    expect(await getStaff()).toBeNull();
  });

  it("rate limits by normalized email across requests, then reopens after the fixed window", async () => {
    await staffWithEmail();
    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await login({ email: " STAFF@EXAMPLE.COM ", pin: "9999" })).status).toBe(401);
    }
    const response = await login();
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("900");
    await prisma.staffLoginWindow.updateMany({ data: { expiresAt: new Date("2000-01-01") } });
    expect((await login()).status).toBe(200);
  });

  it("serializes concurrent login attempts and persists limits independently of sessions", async () => {
    const responses = await Promise.all(Array.from({ length: 7 }, () => login()));
    expect(responses.filter(response => response.status === 401)).toHaveLength(5);
    expect(responses.filter(response => response.status === 429)).toHaveLength(2);
    expect(await prisma.staffLoginWindow.count()).toBe(1);
  });

  it("rejects expired, tampered, and no-longer-active sessions", async () => {
    const user = await staffWithEmail();
    await login();
    const token = cookieJar.get("kenji_leave_session")!;
    cookieJar.set("kenji_leave_session", "a".repeat(43));
    expect(await getStaff()).toBeNull();
    cookieJar.set("kenji_leave_session", token);
    await prisma.staffSession.updateMany({ data: { expiresAt: new Date("2000-01-01") } });
    expect(await getStaff()).toBeNull();
    await login();
    await prisma.user.update({ where: { id: user.id }, data: { status: "INACTIVE" } });
    expect(await getStaff()).toBeNull();
  });
});

afterEach(() => vi.unstubAllEnvs());

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

  it("makes a new registration searchable immediately when auto-approval is enabled", async () => {
    vi.stubEnv("AUTO_APPROVE_STAFF", "true");
    const response = await register(request("/api/register", { fullName: "Integration Staff", pin: "0123" }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ status: "ACTIVE" });
    const user = await prisma.user.findFirstOrThrow();
    expect(user.status).toBe("ACTIVE");
    expect(user.role).toBe("STAFF");
    expect(await bcrypt.compare("0123", user.pinHash)).toBe(true);
    const results = await (await search(new Request("http://localhost/api/staff?q=inte"))).json();
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
