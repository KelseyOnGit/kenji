"use client";

import { useEffect, useRef, useState } from "react";
import type { StaffProfile } from "@leave/lib/staff-data";
import { displayLeaveDate, leaveDates, leaveStatuses, leaveTypes } from "@leave/lib/leave";
import styles from "@leave/app/admin/(portal)/staff/staff.module.css";

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();

export function StaffProfileLeave({ requests }: { requests: StaffProfile["leave"] }) {
  return (
    <section className={styles.leaveSection} aria-labelledby="profile-leave-title">
      <header className={styles.leaveSummary}>
        <div><h3 id="profile-leave-title">Leave requests</h3><p>Showing the 25 most recent requests.</p></div>
        <span className={styles.badge}>{requests.filter(request => request.status === "PENDING").length} pending</span>
      </header>
      {requests.length === 0 ? (
        <div className={styles.profileEmpty}><h3>No leave requests</h3><p>This staff member has not submitted any leave requests.</p></div>
      ) : (
        <div className={styles.leaveList}>
          {requests.map(request => {
            const dates = leaveDates(request);
            return (
              <article className={styles.leaveItem} key={request.id}>
                <header>
                  <div><h4>{leaveTypes[request.type]}</h4><p>Submitted {request.submittedAt}</p></div>
                  <span className={`${styles.badge} ${styles[request.status.toLowerCase()]}`}>{leaveStatuses[request.status]}</span>
                </header>
                <p className={styles.leaveDates}>
                  {displayLeaveDate(dates.startDate)}{dates.startTime && `, ${dates.startTime}`}
                  {" - "}
                  {displayLeaveDate(dates.endDate)}{dates.endTime && `, ${dates.endTime}`}
                  {request.allDay && " (whole days)"}
                </p>
                <p>Back to work: {displayLeaveDate(request.returnDate)}{request.returnTime && `, ${request.returnTime}`}</p>
                <p className={styles.leaveReason}>{request.reason}</p>
                {request.reviewer && <p className={styles.leaveMeta}>Reviewed by {request.reviewer}</p>}
                {request.decisionNote && <p className={styles.leaveNote}><strong>Decision note:</strong> {request.decisionNote}</p>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function StaffProfileDialog({ person, onClose }: {
  person: StaffProfile;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState("overview");
  useEffect(() => { dialog.current?.showModal(); }, []);

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="staff-profile-heading"
      onClose={onClose}>
      <header className={styles.dialogHeader}>
        <div className={styles.profileIdentity}>
          <span className={styles.profileAvatar} aria-hidden="true">{initials(person.displayName)}</span>
          <div>
            <p className={styles.eyebrow}>Staff profile</p>
            <h2 id="staff-profile-heading">{person.displayName}</h2>
            <p className={styles.legalName}>{person.legalName}</p>
          </div>
        </div>
        <button type="button" className={styles.closeButton} onClick={() => dialog.current?.close()}>Close</button>
      </header>

      <nav className={styles.profileTabs} aria-label="Profile sections">
        <button type="button" aria-current={tab === "overview" ? "page" : undefined} onClick={() => setTab("overview")}>Overview</button>
        <button type="button" aria-current={tab === "timesheets" ? "page" : undefined} onClick={() => setTab("timesheets")}>Timesheets</button>
        <button type="button" aria-current={tab === "leave" ? "page" : undefined} onClick={() => setTab("leave")}>Leave</button>
        <button type="button" aria-current={tab === "activity" ? "page" : undefined} onClick={() => setTab("activity")}>Activity</button>
      </nav>

      {tab === "overview" && (
        <dl className={styles.profileDetails}>
          <div><dt>Status</dt><dd><span className={`${styles.badge} ${styles[person.status.toLowerCase()]}`}>{person.status.toLowerCase()}</span></dd></div>
          <div><dt>Phone</dt><dd>{person.phone ?? "Not provided"}</dd></div>
          <div><dt>Email</dt><dd>{person.email ?? "Not provided"}</dd></div>
          <div><dt>Registered</dt><dd>{person.registeredAt}</dd></div>
        </dl>
      )}
      {tab === "timesheets" && <div className={styles.profileEmpty}><h3>Timesheets</h3><p>Timesheet history will be added next.</p></div>}
      {tab === "leave" && <StaffProfileLeave requests={person.leave} />}
      {tab === "activity" && <div className={styles.profileEmpty}><h3>Activity</h3><p>Profile activity will be added with the staff audit workflow.</p></div>}
    </dialog>
  );
}
