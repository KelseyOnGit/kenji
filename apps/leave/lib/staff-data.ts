import { prisma } from "@kenji/database";
import { formatPhoneForDisplay } from "@kenji/web/identity";
import { perthDisplay } from "./timesheets";
import type { Prisma } from "@prisma/client";

const staffProfileSelect = {
  id: true,
  displayName: true,
  legalName: true,
  status: true,
  email: true,
  phone: true,
  createdAt: true,
} satisfies Prisma.UserSelect;


type StaffProfileRecord = Prisma.UserGetPayload<{
    select: typeof staffProfileSelect;
}>;

const staffDate = (date: Date) => perthDisplay(date, {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function formatStaffProfile(person: StaffProfileRecord): StaffProfile {
  return {
    id: person.id,
    displayName: person.displayName,
    legalName: person.legalName,
    status: person.status,
    email: person.email,
    phone: person.phone
      ? formatPhoneForDisplay(person.phone)
      : null,
    registeredAt: staffDate(person.createdAt),
  };
}

/** What the pending approval page needs for one person. Plain strings only, so it can go to the browser. */
export type PendingStaff = {
  id: string;
  legalName: string;
  displayName: string;
  email: string | null;
  phone: string | null;       // formatted for display, e.g. "0412 345 678"
  registeredAt: string;       // Perth time, e.g. "23 Nov 2026, 11:39"
  possibleDuplicate: { displayName: string; status: "ACTIVE" | "INACTIVE" } | null;
};

export type StaffProfile = {
  id: string;
  displayName: string;
  legalName: string;
  status: "ACTIVE" | "INACTIVE" | "PENDING";
  email: string | null;
  phone: string | null;       // formatted for display, e.g. "0412 345 678"
  registeredAt: string;       // Perth time, e.g. "23 Nov 2026, 11:39"
};

export type StaffStatus = StaffProfile["status"];


const pendingWhere = { role: "STAFF", status: "PENDING" } as const;

/** Number of new sign-ups waiting for approval (sidebar badge and dashboard). */
export function pendingStaffCount() {
  return prisma.user.count({ where: pendingWhere });
}

/** Everyone waiting for approval, oldest first, with a warning if they look like an existing staff member. */
export async function pendingStaff(): Promise<PendingStaff[]> {
  const people = await prisma.user.findMany({
    where: pendingWhere,
    // Only the fields the page shows. Never select pinHash or passwordHash here.
    select: { id: true, legalName: true, displayName: true, email: true, phone: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (people.length === 0) return [];

  // One query finds existing staff whose legal name matches any pending person (ignoring case).
  const existing = await prisma.user.findMany({
    where: {
      role: "STAFF",
      status: { in: ["ACTIVE", "INACTIVE"] },
      OR: people.map(person => ({ legalName: { equals: person.legalName, mode: "insensitive" as const } })),
    },
    select: { legalName: true, displayName: true, status: true },
  });
  const byName = new Map(existing.map(user => [user.legalName.trim().toLocaleLowerCase(), user]));

  return people.map(person => {
    const match = byName.get(person.legalName.trim().toLocaleLowerCase());
    return {
      id: person.id,
      legalName: person.legalName,
      displayName: person.displayName,
      email: person.email,
      phone: person.phone ? formatPhoneForDisplay(person.phone) : null,
      registeredAt: perthDisplay(person.createdAt, {
                day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      }),
      possibleDuplicate: match && match.status !== "PENDING"
        ? { displayName: match.displayName, status: match.status }
        : null,
    };
  });
}

export async function staffProfile(userId: string): Promise<StaffProfile | null> {
  const person = await prisma.user.findUnique({
    where: { id: userId, role: "STAFF" },
    select: staffProfileSelect,
  });

  return person ? formatStaffProfile(person) : null;
}

export async function staffList(status: StaffStatus): Promise<StaffProfile[]> {
  const people = await prisma.user.findMany({
    where: { role: "STAFF", status },
    select: staffProfileSelect,
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
  });

  return people.map(formatStaffProfile);
}

export async function staffCounts() {
  const [active, pending, inactive] = await Promise.all([
    prisma.user.count({ where: { role: "STAFF", status: "ACTIVE" } }),
    prisma.user.count({ where: pendingWhere }),
    prisma.user.count({ where: { role: "STAFF", status: "INACTIVE" } }),
  ]);

  return { active, pending, inactive };
}
