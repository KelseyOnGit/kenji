import Link from "next/link";
import { randomUUID } from "node:crypto";
import { approvedCalendar, privateRequests } from "@leave/lib/leave-data";
import { leaveStatuses, monthWindow, type LeaveStatus } from "@leave/lib/leave";
import LeaveCalendar from "./LeaveCalendar";
import LeaveRequests from "./LeaveRequests";
import styles from "./leave.module.css";

export type LeaveSearch = { month?: string | string[]; status?: string | string[]; page?: string | string[] };

export default async function LeaveWorkspace({ params, staffId }: { params: LeaveSearch; staffId?: string }) {
  const admin = !staffId;
  const month = monthWindow(typeof params.month === "string" ? params.month : undefined).month;
  const statuses = Object.keys(leaveStatuses) as LeaveStatus[];
  const status = admin
    ? statuses.find(status => status === params.status) ?? (params.status === "ALL" ? undefined : "PENDING")
    : undefined;
  const requestedPage = typeof params.page === "string" && /^\d{1,6}$/.test(params.page) ? Math.max(1, Number(params.page)) : 1;
  const [calendar, list] = await Promise.all([
    approvedCalendar(month), privateRequests({ staffId, status, page: requestedPage }),
  ]);
  const basePath = admin ? "/admin/leave" : "/";
  const link = (page: number, filter = params.status) => `${basePath}?${new URLSearchParams({
    month, ...(admin && typeof filter === "string" ? { status: filter } : {}), page: String(page),
  })}`;
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>{admin ? "Admin / Leave" : "Staff portal"}</p>
        <h1>{admin ? "Leave requests" : "Leave calendar & requests"}</h1>
      </header>
      <LeaveCalendar month={month} leaves={calendar} basePath={basePath} />
      {admin && (
        <nav className={styles.filters} aria-label="Filter leave requests">
          {([...statuses, "ALL"] as const).map(value => (
            <Link key={value} href={link(1, value)} aria-current={(status ?? "ALL") === value ? "page" : undefined}>
              {value === "ALL" ? "All requests" : leaveStatuses[value]}
            </Link>
          ))}
        </nav>
      )}
      <LeaveRequests requests={list.rows} admin={admin} submissionId={randomUUID()} />
      <nav className={styles.pagination} aria-label="Request pages">
        {list.page > 1 && <Link href={link(list.page - 1)}>Previous requests</Link>}
        <span>{list.count} request(s) - Page {list.page} of {list.pages}</span>
        {list.page < list.pages && <Link href={link(list.page + 1)}>More requests</Link>}
      </nav>
    </div>
  );
}
