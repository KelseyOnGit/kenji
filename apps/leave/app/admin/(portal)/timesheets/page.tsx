import Link from "next/link";
import { z } from "zod";
import { prisma } from "@kenji/database";
import { requireAdmin } from "@leave/lib/session";
import { databaseNow } from "@leave/lib/timesheet-writes";
import { DAY_MS, parseWeekParam, perthDisplay, toPerthLocal } from "@leave/lib/timesheets";
import TimesheetTable from "@leave/components/TimesheetTable";
import styles from "./timesheets.module.css";

export const instant = false;
const snapshot = z.object({ clockIn: z.iso.datetime(), clockOut: z.iso.datetime().nullable() });

export default async function TimesheetsPage({ searchParams }: {
  searchParams: Promise<{ week?: string | string[]; q?: string | string[]; problems?: string | string[] }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const week = parseWeekParam(typeof params.week === "string" ? params.week : undefined);
  const end = new Date(week.getTime() + 7 * DAY_MS);
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const problems = params.problems === "1";
  const [now, staff, worked] = await Promise.all([
    databaseNow(prisma),
    prisma.user.findMany({
      where: { role: "STAFF", status: { in: ["ACTIVE", "INACTIVE"] } },
      select: { id: true, displayName: true }, orderBy: [{ displayName: "asc" }, { id: "asc" }],
    }),
    prisma.user.findMany({
      where: { role: "STAFF", shifts: { some: { clockIn: { gte: week, lt: end } } } },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      select: {
        id: true, displayName: true, status: true,
        shifts: {
          where: { clockIn: { gte: week, lt: end } }, orderBy: { clockIn: "asc" },
          select: {
            id: true, clockIn: true, clockOut: true, updatedAt: true, edited: true,
            audits: {
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              select: { id: true, action: true, before: true, after: true, reason: true, createdAt: true, actor: { select: { displayName: true } } },
            },
          },
        },
      },
    }),
  ]);
  const rows = worked.map(user => ({
      ...user,
      shifts: user.shifts.map(shift => ({
        ...shift, clockIn: shift.clockIn.toISOString(), clockOut: shift.clockOut?.toISOString() ?? null,
        updatedAt: shift.updatedAt.toISOString(),
        audits: shift.audits.map(audit => ({
          id: audit.id, action: audit.action, reason: audit.reason, actor: audit.actor.displayName,
          createdAt: audit.createdAt.toISOString(),
          before: audit.before === null ? null : snapshot.parse(audit.before), after: snapshot.parse(audit.after),
        })),
      })),
    }));
  const weekDate = toPerthLocal(week).slice(0, 10);
  const link = (date: Date) => `/admin/timesheets?${new URLSearchParams({
    week: toPerthLocal(date).slice(0, 10), ...(q ? { q } : {}), ...(problems ? { problems: "1" } : {}),
  })}`;
  const titleStart = perthDisplay(week, { weekday: "short", day: "numeric", month: "short" });
  const titleEnd = perthDisplay(new Date(week.getTime() + 4 * DAY_MS), { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>Admin / Worked hours</p><h1>Timesheets</h1>
          <p>{titleStart} – {titleEnd}</p><p className={styles.context}>Perth time · Monday–Friday · Completed hours only</p></div>
        <nav className={styles.weekNav} aria-label="Timesheet week">
          <Link href={link(new Date(week.getTime() - 7 * DAY_MS))}>← Previous</Link>
          <span aria-hidden="true"> / </span>
          <Link href={link(parseWeekParam(undefined))}>This week</Link>
          <span aria-hidden="true"> / </span>
          <Link href={link(end)}>Next →</Link>
        </nav>
      </header>
      <TimesheetTable key={`${weekDate}:${q}:${problems}`} rows={rows} staff={staff} week={weekDate} now={now.toISOString()} initialSearch={q} initialProblems={problems} />
    </div>
  );
}
