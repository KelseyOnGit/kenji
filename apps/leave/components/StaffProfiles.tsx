"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { StaffProfile, StaffStatus } from "@leave/lib/staff-data";
import styles from "@leave/app/admin/(portal)/staff/staff.module.css";
import StaffProfileDialog from "./StaffProfileDialog";
import EditStaffDetails from "./EditStaffDetails";

export default function StaffProfiles({
  initialPeople,
  initialStatus,
  counts,
}: {
  initialPeople: StaffProfile[];
  initialStatus: StaffStatus;
  counts: { active: number; pending: number; inactive: number };
}) {
  const people = initialPeople;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StaffProfile | null>(null);

  const visible = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();

    return people.filter(person =>
      !search ||
      [person.displayName, person.legalName, person.email, person.phone]
        .filter(Boolean)
        .some(value => value!.toLocaleLowerCase().includes(search))
    );
  }, [people, query]);

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Admin / Staff</p>
          <h1>Staff profiles</h1>
          <p>Review staff identity, contact details and account status.</p>
        </div>
        <a className={styles.pendingLink} href="/admin/pending-approval">
          {counts.pending} pending approval
        </a>
      </header>

      <nav className={styles.tabs} aria-label="Staff status">
        {(["ACTIVE", "PENDING", "INACTIVE"] as const).map(value => (
          <Link
            key={value}
            href={`/admin/staff?status=${value}`}
            aria-current={initialStatus === value ? "page" : undefined}
          >
            {value[0] + value.slice(1).toLowerCase()}
            <span>{counts[value.toLowerCase() as "active" | "pending" | "inactive"]}</span>
          </Link>
        ))}
      </nav>

      <div className={styles.toolbar}>
        <label>
          <span className={styles.srOnly}>Search staff</span>
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search name, email or phone..."
          />
        </label>
        <span>{visible.length} result{visible.length === 1 ? "" : "s"}</span>
      </div>

      <div className={styles.list}>
        {visible.map(person => (
          <article className={styles.card} key={person.id}>
            <div className={styles.identity}>
              <span className={styles.avatar} aria-hidden="true">
                {person.displayName[0]?.toUpperCase()}
              </span>
              <div>
                <h2>{person.displayName}</h2>
                <p>{person.legalName}</p>
              </div>
              <span className={`${styles.badge} ${styles[person.status.toLowerCase()]}`}>
                {person.status.toLowerCase()}
              </span>
            </div>

            <dl>
              <div><dt>Phone</dt><dd>{person.phone ?? "Not provided"}</dd></div>
              <div><dt>Email</dt><dd>{person.email ?? "Not provided"}</dd></div>
              <div><dt>Registered</dt><dd>{person.registeredAt}</dd></div>
            </dl>

            <button type="button" onClick={() => setSelected(person)}>
              View profile
            </button>
            <EditStaffDetails profile={person} />
          </article>
        ))}
      </div>

      {!visible.length && <p className={styles.empty}>No staff profiles match this view.</p>}

      {selected && (
        <StaffProfileDialog person={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}