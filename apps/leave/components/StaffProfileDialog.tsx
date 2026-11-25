"use client";

import { useEffect, useRef, useState } from "react";
import type { StaffProfile } from "@leave/lib/staff-data";
import styles from "@leave/app/admin/(portal)/staff/staff.module.css";

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();

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
      {tab === "leave" && <div className={styles.profileEmpty}><h3>Leave</h3><p>Leave history will be added next.</p></div>}
      {tab === "activity" && <div className={styles.profileEmpty}><h3>Activity</h3><p>Profile activity will be added with the staff audit workflow.</p></div>}
    </dialog>
  );
}
