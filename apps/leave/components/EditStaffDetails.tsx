"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@kenji/web/client-api";
import { successSchema, updateStaffSchema } from "@leave/lib/contracts";
import type { StaffProfile } from "@leave/lib/staff-data";
import styles from "@leave/app/admin/(portal)/staff/profile.module.css";

export default function EditStaffDetails({ profile }: { profile: StaffProfile }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function open() {
    setError("");
    setSaved(false);
    dialog.current?.showModal();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    // Check in the browser first with the same rules the server uses, for instant feedback.
    const parsed = updateStaffSchema.safeParse({
      userId: profile.id,
      expectedUpdatedAt: profile.updatedAt,
      legalName: form.get("legalName"),
      displayName: form.get("displayName"),
      phone: form.get("phone"),
      email: form.get("email"),
      employmentType: form.get("employmentType"),
    });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }

    setPending(true);
    setError("");
    try {
      await requestJson("/api/admin/staff/update", successSchema, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data),
      });
      dialog.current?.close();
      setSaved(true);
      router.refresh(); // reload the profile from the server so the page shows the new details
    } catch (error) {
      setError(error instanceof Error ? error.message : "The details could not be saved. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={open}>Edit details</button>
      {saved && <p className={styles.saved} role="status">Details saved.</p>}
      <dialog ref={dialog} className={styles.dialog} aria-labelledby="edit-details-title"
        onCancel={event => { if (pending) event.preventDefault(); }}>
        <h2 id="edit-details-title">Edit details</h2>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {/* key: when the profile reloads after saving, the form resets to the fresh values */}
        <form key={profile.updatedAt} onSubmit={save} className={styles.form} aria-busy={pending}>
          <fieldset disabled={pending}>
            <label>Legal name<span>As on their tax and bank records</span>
              <input name="legalName" required minLength={2} maxLength={120} defaultValue={profile.legalName} autoComplete="off" />
            </label>
            <label>Preferred name<span>Shown on the kiosk and in the app</span>
              <input name="displayName" required minLength={2} maxLength={120} defaultValue={profile.displayName} autoComplete="off" />
            </label>
            <label>Contact number
              <input name="phone" type="tel" inputMode="tel" maxLength={30} defaultValue={profile.phone ?? ""} placeholder="0412 345 678" autoComplete="off" />
            </label>
            <label>Email
              <input name="email" type="email" maxLength={254} defaultValue={profile.email ?? ""} autoComplete="off" />
            </label>
            <label>Employment type
              <select name="employmentType" required defaultValue={profile.employmentType ?? ""}>
                <option value="" disabled>Choose…</option>
                <option value="FULL_TIME">Full-time</option>
                <option value="CASUAL">Casual</option>
              </select>
          </label>
            <div className={styles.dialogActions}>
              <button type="button" onClick={() => dialog.current?.close()}>Cancel</button>
              <button type="submit" className={styles.primary}>{pending ? "Saving..." : "Save changes"}</button>
            </div>
          </fieldset>
        </form>
      </dialog>
    </>
  );
}