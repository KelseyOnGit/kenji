"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { PendingStaff } from "@leave/lib/staff-data";
import StaffProfile from "./StaffProfile";
import styles from "@leave/app/admin/(portal)/pending-approval/pending.module.css";

export default function PendingApprovals({ initialPeople }: { initialPeople: PendingStaff[] }) {
  const router = useRouter();
  const [people, setPeople] = useState(initialPeople);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PendingStaff | null>(null);
  const [notice, setNotice] = useState("");
  const visible = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return search ? people.filter(person =>
      [person.displayName, person.legalName, person.email, person.phone]
        .filter(Boolean)
        .some(value => value!.toLocaleLowerCase().includes(search))
    ) : people;
  }, [people, query]);

  function approved(userId: string) {
    const person = people.find(item => item.id === userId);
    setPeople(current => current.filter(item => item.id !== userId));
    setSelected(null);
    setNotice(`${person?.displayName ?? "Staff profile"} approved successfully.`);
    router.refresh();
  }

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Admin / Staff</p>
          <h1>Pending approval</h1>
          <p>Review new kiosk registrations before allowing clock-in and portal access.</p>
        </div>
        <span className={styles.count}>{people.length} pending</span>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <span className={styles.srOnly}>Search pending staff</span>
          <input type="search" value={query} maxLength={120} onChange={event => setQuery(event.target.value)}
            placeholder="Search name, email or phone..." />
        </label>
        <span>{visible.length} result{visible.length === 1 ? "" : "s"}</span>
      </div>

      {notice && <p className={styles.success} role="status">{notice}</p>}
      {people.length === 0 ? (
        <div className={styles.empty}>
          <h2>All caught up</h2>
          <p>There are no pending staff registrations.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className={styles.empty}><h2>No matching registrations</h2><p>Try a different name, email or phone number.</p></div>
      ) : (
        <div className={styles.list}>
          {visible.map(person => (
            <article className={styles.card} key={person.id}>
              <div className={styles.person}>
                <span className={styles.avatarSmall} aria-hidden="true">{person.displayName[0]?.toUpperCase()}</span>
                <div>
                  <h2>{person.displayName}</h2>
                  <p>{person.legalName}</p>
                </div>
              </div>
              <dl className={styles.summary}>
                <div><dt>Phone</dt><dd>{person.phone ?? "Not provided"}</dd></div>
                <div><dt>Email</dt><dd>{person.email ?? "Not provided"}</dd></div>
                <div><dt>Registered</dt><dd>{person.registeredAt}</dd></div>
              </dl>
              {person.possibleDuplicate && <p className={styles.inlineWarning}>Possible duplicate of {person.possibleDuplicate.displayName}</p>}
              <button type="button" className={styles.reviewButton} onClick={() => setSelected(person)}>Review profile</button>
            </article>
          ))}
        </div>
      )}

      {selected && <StaffProfile person={selected} onClose={() => setSelected(null)} onApproved={approved} />}
    </section>
  );
}
