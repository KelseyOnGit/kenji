import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    $queryRaw: vi.fn(),
    user: { findUnique: vi.fn(), update: vi.fn() },
  };
  return {
    transaction,
    prisma: {
      $transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    },
    requireAdminApi: vi.fn(),
  };
});

vi.mock("@kenji/database", () => ({ prisma: mocks.prisma }));
vi.mock("@leave/lib/session", () => ({ requireAdminApi: mocks.requireAdminApi }));

import { POST as approve } from "@leave/app/api/admin/staff/approve/route";

function request(body: unknown) {
  return new Request("http://localhost/api/admin/staff/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdminApi.mockResolvedValue({ id: "admin-id" });
  mocks.transaction.user.findUnique.mockResolvedValue({ id: "staff-id", role: "STAFF", status: "PENDING" });
  mocks.transaction.user.update.mockResolvedValue({});
  mocks.transaction.$queryRaw.mockResolvedValue([{ now: new Date("2026-11-23T05:00:00.000Z") }]);
});

describe("POST /api/admin/staff/approve", () => {
  it("approves a pending staff profile and records the approving admin", async () => {
    const response = await approve(request({ userId: "staff-id" }));
    expect(response.status).toBe(200);
    expect(mocks.transaction.user.update).toHaveBeenCalledWith({
      where: { id: "staff-id" },
      data: {
        status: "ACTIVE",
        approvedAt: new Date("2026-11-23T05:00:00.000Z"),
        approvedById: "admin-id",
      },
    });
  });

  it("rejects stale and non-staff approvals", async () => {
    mocks.transaction.user.findUnique.mockResolvedValueOnce({ id: "staff-id", role: "STAFF", status: "ACTIVE" });
    expect((await approve(request({ userId: "staff-id" }))).status).toBe(409);

    mocks.transaction.user.findUnique.mockResolvedValueOnce({ id: "admin-id", role: "ADMIN", status: "PENDING" });
    expect((await approve(request({ userId: "admin-id" }))).status).toBe(404);
    expect(mocks.transaction.user.update).not.toHaveBeenCalled();
  });

  it("does not accept employment details", async () => {
    expect((await approve(request({ userId: "staff-id", employmentType: "FULL_TIME" }))).status).toBe(400);
    expect(mocks.transaction.user.update).not.toHaveBeenCalled();
  });
});
