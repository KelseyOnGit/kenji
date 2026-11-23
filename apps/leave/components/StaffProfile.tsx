"use client";

import { useEffect, useRef, useState } from "react";
import { requestJson } from "@kenji/web/client-api";
import { successSchema } from "@leave/lib/contracts";
import type { PendingStaff } from "@leave/lib/staff-data";
import styles from "@leave/app/admin/(portal)/pending-approval/pending.module.css";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

export default function StaffProfile({ person, onClose, onApproved }: {
  person: PendingStaff;
  onClose: () => void;
  onApproved: (userId: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);

  async function approve() {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      await requestJson("/api/admin/staff/approve", successSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: person.id }),
      });
      onApproved(person.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "The staff profile could not be approved.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <dialog ref={dialog} className={styles.profileDialog} aria-labelledby="staff-profile-title"
      onCancel={event => { if (pending) event.preventDefault(); }}>
      <header className={styles.dialogHeader}>
        <div className={styles.profileIdentity}>
          <span className={styles.avatar} aria-hidden="true">{initials(person.displayName)}</span>
          <div>
            <p className={styles.eyebrow}>Pending staff profile</p>
            <h2 id="staff-profile-title">{person.displayName}</h2>
            <p className={styles.legalName}>{person.legalName}</p>
          </div>
        </div>
        <button type="button" className={styles.secondaryButton} disabled={pending} onClick={onClose}>Close</button>
      </header>

      {person.possibleDuplicate && <p className={styles.warning} role="alert">
        Possible duplicate: an {person.possibleDuplicate.status.toLowerCase()} staff profile named {person.possibleDuplicate.displayName}
        already uses this legal name. Verify the profile before approving.
      </p>}

      <dl className={styles.profileDetails}>
        <div><dt>Status</dt><dd><span className={styles.status}>Pending approval</span></dd></div>
        <div><dt>Phone</dt><dd>{person.phone ?? "Not provided"}</dd></div>
        <div><dt>Email</dt><dd>{person.email ?? "Not provided"}</dd></div>
        <div><dt>Registered</dt><dd>{person.registeredAt}</dd></div>
      </dl>

      <p className={styles.explanation}>
        Approval makes this staff profile active for kiosk clock-in and staff portal sign-in.
      </p>
      {error && <p className={styles.error} role="alert">{error}</p>}

      {confirming ? (
        <section className={styles.confirmation} aria-labelledby="approve-confirmation">
          <h3 id="approve-confirmation">Approve {person.displayName}?</h3>
          <p>Confirm the identity and contact details are correct.</p>
          <div className={styles.dialogActions}>
            <button type="button" className={styles.secondaryButton} disabled={pending} onClick={() => setConfirming(false)}>Back</button>
            <button type="button" className={styles.primaryButton} disabled={pending} onClick={() => void approve()}>
              {pending ? "Approving..." : "Confirm approval"}
            </button>
          </div>
        </section>
      ) : (
        <div className={styles.dialogActions}>
          <button type="button" className={styles.primaryButton} onClick={() => setConfirming(true)}>Approve staff</button>
        </div>
      )}
    </dialog>
  );
}
