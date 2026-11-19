"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@kenji/web/client-api";
import { leaveCreateSchema, leaveEditSchema, successSchema } from "@leave/lib/contracts";
import { displayLeaveDate, leaveDates, leaveStatuses, leaveTypes, type PrivateLeave } from "@leave/lib/leave";
import { perthDisplay, toPerthLocal } from "@leave/lib/timesheets";
import styles from "./leave.module.css";

const actions: Record<string, string> = {
  SUBMITTED: "Submitted", UPDATED: "Updated", APPROVED: "Approved", REJECTED: "Rejected", CANCELLED: "Cancelled",
};
const stamp = (value: string) => perthDisplay(new Date(value), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export default function LeaveRequests({ requests, submissionId, admin = false }: {
  requests: PrivateLeave[]; submissionId: string; admin?: boolean;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const requestId = useRef<string | null>(null);
  const [editing, setEditing] = useState<PrivateLeave | null>(null);
  const [cancelling, setCancelling] = useState<PrivateLeave | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [pending, setPending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [usedSubmissionId, setUsedSubmissionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [allDay, setAllDay] = useState(true);

  function openForm(leave: PrivateLeave | null, cancel = false) {
    setEditing(leave);
    setCancelling(cancel ? leave : null);
    setAllDay(leave?.allDay ?? true);
    setError("");
    setNotice("");
    setFormKey(value => value + 1);
    requestId.current = submissionId;
    setDialogOpen(true);
    dialog.current?.showModal();
  }

  async function send(path: string, body: unknown, message: string, close = false) {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError("");
    setNotice("");
    try {
      await requestJson(path, successSchema, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (close) dialog.current?.close();
      setNotice(message);
      router.refresh();
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "The request could not be saved. Please try again.");
      return false;
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = new FormData(event.currentTarget);
    const values = {
      type: form.get("type"),
      allDay, startDate: String(form.get("startDate") ?? ""), endDate: String(form.get("endDate") ?? ""),
      startTime: allDay ? "" : String(form.get("startTime") ?? ""),
      endTime: allDay ? "" : String(form.get("endTime") ?? ""),
      returnDate: String(form.get("returnDate") ?? ""), returnTime: String(form.get("returnTime") ?? ""),
      reason: String(form.get("reason") ?? ""),
    };
    if (editing) {
      const parsed = leaveEditSchema.safeParse({ ...values, leaveId: editing.id, expectedVersion: editing.version });
      if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
      await send("/api/leave/edit", parsed.data, "Request updated. It is still awaiting approval.", true);
    } else {
      // The server-issued UUID stays unchanged for retries, including a lost response.
      const parsed = leaveCreateSchema.safeParse({ ...values, requestId: requestId.current });
      if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
      if (await send("/api/leave/create", parsed.data, "Leave request submitted for approval.", true)) {
        setUsedSubmissionId(parsed.data.requestId);
      }
    }
  }

  const dates = editing ? leaveDates(editing) : null;
  return (
    <section className={styles.panel} aria-labelledby="requests-heading">
      <header className={styles.sectionHeader}>
        <div><h2 id="requests-heading">{admin ? "Review leave requests" : "My leave requests"}</h2>
        </div>
        {!admin && <button className={styles.primary} disabled={pending || usedSubmissionId === submissionId} onClick={() => openForm(null)}>Request leave</button>}
      </header>
      {notice && <p className={styles.success} role="status">{notice}</p>}
      {error && !dialogOpen && <p className={styles.error} role="alert">{error}</p>}
      {requests.length === 0 && <p className={styles.empty}>{admin ? "No requests in this view." : "You have not requested any leave yet."}</p>}
      <div className={styles.requests}>
        {requests.map(leave => {
          const dates = leaveDates(leave);
          return (
            <article key={leave.id} className={styles.request}>
              <header className={styles.requestHeading}>
                <div><h3>{admin ? leave.name : leaveTypes[leave.type]}</h3>
                  {admin && <span>{leaveTypes[leave.type]}</span>}</div>
                <span className={`${styles.badge} ${styles[leave.status.toLowerCase()]}`}>{leaveStatuses[leave.status]}</span>
              </header>
              <p className={styles.dates}>
                {displayLeaveDate(dates.startDate)}{dates.startTime && `, ${dates.startTime}`}
                {" - "}{displayLeaveDate(dates.endDate)}{dates.endTime && `, ${dates.endTime}`}
                {leave.allDay && " (whole days)"}
              </p>
              <p>Back to work: {displayLeaveDate(leave.returnDate)}{leave.returnTime && `, ${leave.returnTime}`}</p>
              <p className={styles.reason}>{leave.reason}</p>
              {leave.reviewer && <p>{leave.status === "CANCELLED" ? "Previous decision" : leaveStatuses[leave.status]} by {leave.reviewer}{leave.decidedAt && ` on ${stamp(leave.decidedAt)}`}</p>}
              {leave.decisionNote && <p className={styles.note}><strong>Admin note:</strong> {leave.decisionNote}</p>}
              {admin && leave.status === "PENDING" && (
                <form method="post" className={styles.review} onSubmit={event => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const submitter = event.nativeEvent instanceof SubmitEvent ? event.nativeEvent.submitter : null;
                  if (!(submitter instanceof HTMLButtonElement)) { setError("Choose Approve or Reject."); return; }
                  void send("/api/admin/leave/review", {
                    leaveId: leave.id, expectedVersion: leave.version,
                    decision: submitter.value, note: String(form.get("note") ?? ""),
                  }, submitter.value === "APPROVED" ? "Leave approved and added to the team calendar." : "Leave request rejected.");
                }}>
                  <label htmlFor={`note-${leave.id}`}>Decision note <span>(optional)</span></label>
                  <textarea id={`note-${leave.id}`} name="note" maxLength={1000} rows={2} disabled={pending} />
                  <div className={styles.actions}>
                    <button className={styles.primary} type="submit" value="APPROVED" disabled={pending}>Approve</button>
                    <button className={styles.secondary} type="submit" value="REJECTED" disabled={pending}>Reject</button>
                  </div>
                </form>
              )}
              {!admin && ["PENDING", "APPROVED"].includes(leave.status) && (
                <div className={styles.actions}>
                  {leave.status === "PENDING" && <button className={styles.secondary} disabled={pending} onClick={() => openForm(leave)}>Edit request</button>}
                  <button className={styles.textButton} disabled={pending} onClick={() => openForm(leave, true)}>Cancel request</button>
                </div>
              )}
              <details className={styles.history}><summary>Request history</summary>
                <ol>{leave.events.map(event => <li key={event.id}><strong>{actions[event.action] ?? event.action}</strong> by {event.actor} - {stamp(event.createdAt)}
                  {event.note && <p>{event.note}</p>}</li>)}</ol>
              </details>
            </article>
          );
        })}
      </div>
      {!admin && (
        <dialog ref={dialog} className={styles.dialog} aria-labelledby="leave-dialog-title" onClose={() => setDialogOpen(false)} onCancel={event => { if (pending) event.preventDefault(); }}>
          <header className={styles.sectionHeader}>
            <h2 id="leave-dialog-title">{cancelling ? "Cancel leave request?" : editing ? "Edit leave request" : "Request leave"}</h2>
            <button type="button" className={styles.secondary} disabled={pending} onClick={() => dialog.current?.close()}>Close</button>
          </header>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {cancelling ? (
            <div><p>This will cancel your {leaveStatuses[cancelling.status].toLowerCase()} request and remove it from the shared calendar if approved. Its history will be kept.</p>
              <button className={styles.primary} disabled={pending} onClick={() => void send("/api/leave/cancel", {
                leaveId: cancelling.id, expectedVersion: cancelling.version,
              }, "Leave request cancelled.", true)}>{pending ? "Cancelling..." : "Confirm cancellation"}</button></div>
          ) : (
            <form key={formKey} method="post" onSubmit={submit} className={styles.form} aria-busy={pending}>
              <label htmlFor="leave-type">Leave type</label>
              <select id="leave-type" name="type" defaultValue={editing?.type ?? "ANNUAL"} disabled={pending}>
                {Object.entries(leaveTypes).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
              <label className={styles.checkbox}><input type="checkbox" checked={allDay} disabled={pending} onChange={event => setAllDay(event.target.checked)} /> Whole days</label>
              <div className={styles.fields}>
                <label>From date<input type="date" name="startDate" required defaultValue={dates?.startDate ?? toPerthLocal(new Date()).slice(0, 10)} disabled={pending} /></label>
                <label>To date<input type="date" name="endDate" required defaultValue={dates?.endDate ?? toPerthLocal(new Date()).slice(0, 10)} disabled={pending} /></label>
              </div>
              {!allDay && <><p>Partial-day leave must start and finish on the same date.</p><div className={styles.fields}>
                <label>Start time<input type="time" name="startTime" required defaultValue={dates?.startTime ?? ""} disabled={pending} /></label>
                <label>End time<input type="time" name="endTime" required defaultValue={dates?.endTime ?? ""} disabled={pending} /></label>
              </div></>}
              <div className={styles.fields}>
                <label>Back to work date<input type="date" name="returnDate" required defaultValue={editing?.returnDate ?? ""} disabled={pending} /></label>
              </div>
              <label htmlFor="leave-reason">Reason <span>(visible only to you and admins)</span></label>
              <textarea id="leave-reason" name="reason" required minLength={3} maxLength={1000} rows={3} defaultValue={editing?.reason ?? ""} disabled={pending} />
              <button type="submit" className={styles.primary} disabled={pending}>{pending ? "Saving..." : editing ? "Save changes" : "Submit request"}</button>
            </form>
          )}
        </dialog>
      )}
    </section>
  );
}
