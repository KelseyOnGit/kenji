"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@kenji/web/client-api";
import { timesheetSuccessSchema } from "@leave/lib/contracts";
import { DAY_MS, formatHours, missingClockOut, perthDisplay, perthLocalToDate, shiftMinutes, toPerthLocal } from "@leave/lib/timesheets";
import styles from "@leave/app/admin/(portal)/timesheets/timesheets.module.css";

type Snapshot = { clockIn: string; clockOut: string | null };
type Shift = Snapshot & {
  id: string; updatedAt: string; edited: boolean;
  audits: { id: string; actor: string; action: string; createdAt: string; reason: string; before: Snapshot | null; after: Snapshot }[];
};
type Row = { id: string; displayName: string; status: string; shifts: Shift[] };
type Staff = { id: string; displayName: string };
type Selection = { kind: "fix"; user: Staff; shift: Shift } | { kind: "add"; userId: string; date: string };
const time = (date: string) => perthDisplay(new Date(date), { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const fullTime = (date: string) => perthDisplay(new Date(date), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const total = (shifts: Shift[]) => shifts.reduce((sum, shift) => sum + shiftMinutes(new Date(shift.clockIn), shift.clockOut ? new Date(shift.clockOut) : null), 0);
const describeTimes = (value: Snapshot | null) => value ? `${fullTime(value.clockIn)} – ${value.clockOut ? fullTime(value.clockOut) : "Not clocked out"}` : "No shift";
const actionLabels: Record<string, string> = { ADD_SHIFT: "Added shift", EDIT_TIMES: "Edited times", SET_CLOCK_OUT: "Set clock-out" };

export default function TimesheetTable({ rows, staff, week, now, initialSearch = "", initialProblems = false }: {
  rows: Row[]; staff: Staff[]; week: string; now: string; initialSearch?: string; initialProblems?: boolean;
}) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState(initialSearch);
  const [problems, setProblems] = useState(initialProblems);
  const start = perthLocalToDate(`${week}T00:00`);
  const days = Array.from({ length: 5 }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS);
    return { date: toPerthLocal(date).slice(0, 10), label: perthDisplay(date, { weekday: "short", day: "numeric", month: "short" }) };
  });
  const weekdayRows = rows.map(user => ({
    ...user, shifts: user.shifts.filter(shift => days.some(day => toPerthLocal(new Date(shift.clockIn)).startsWith(day.date))),
  }));
  const visibleRows = weekdayRows.filter(user => user.shifts.length
    && user.displayName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
    && (!problems || user.shifts.some(shift => missingClockOut(new Date(shift.clockIn), shift.clockOut ? new Date(shift.clockOut) : null, new Date(now)))));
  const weekendCount = rows.reduce((sum, user, index) => sum + user.shifts.length - weekdayRows[index].shifts.length, 0);
  const close = () => setSelection(null);
  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <label><span className={styles.srOnly}>Search staff</span><input type="search" maxLength={120} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search staff..." /></label>
          <label className={styles.checkbox}><input type="checkbox" role="switch" checked={problems} onChange={event => setProblems(event.target.checked)} />Problems only</label>
        </div>
        <button type="button" onClick={() => setSelection({ kind: "add", userId: "", date: week })} disabled={!staff.length}>+ Add shift</button>
      </div>
      {weekendCount > 0 && <p className={styles.context}>{weekendCount} weekend shift(s) are saved but excluded from this weekday view and its totals.</p>}
      {saved && <p role="status">Correction saved with its edit history.</p>}
      <div className={styles.tableWrap} role="region" aria-label="Weekly timesheets" tabIndex={0}>
        <table className={styles.table}>
          <caption className={styles.srOnly}>Weekday worked hours by clock-in day</caption>
          <thead><tr><th scope="col">Staff member</th>{days.map(day => <th scope="col" key={day.date}>{day.label}</th>)}<th scope="col">Weekly total</th></tr></thead>
          <tbody>{visibleRows.map(user => (
            <tr key={user.id}>
              <th scope="row">{user.displayName}{user.status === "INACTIVE" && <span className={styles.marker}>Inactive</span>}</th>
              {days.map(day => {
                const shifts = user.shifts.filter(shift => toPerthLocal(new Date(shift.clockIn)).startsWith(day.date));
                return <td key={day.date}><div className={styles.dayCell}>
                  {shifts.map(shift => {
                    const missing = missingClockOut(new Date(shift.clockIn), shift.clockOut ? new Date(shift.clockOut) : null, new Date(now));
                    const overnight = shift.clockOut && toPerthLocal(new Date(shift.clockOut)).slice(0, 10) !== day.date;
                    return <button key={shift.id} type="button" className={`${styles.shift} ${missing ? styles.problem : ""}`}
                      onClick={() => setSelection({ kind: "fix", user, shift })}>
                      <span>{time(shift.clockIn)}{shift.clockOut ? `–${time(shift.clockOut)}${overnight ? " (+1 day)" : ""}` : ""}{" · "}
                        {shift.clockOut ? formatHours(shiftMinutes(new Date(shift.clockIn), new Date(shift.clockOut))) : missing ? "Missing clock-out" : "Clocked in"}</span>
                      {shift.edited && <span className={styles.marker}> · Edited</span>}
                    </button>;
                  })}
                  {shifts.length > 1 && <div className={styles.dayTotal}>Total {formatHours(total(shifts))}</div>}
                  {!shifts.length && <span className={styles.emptyDay}>—</span>}
                </div></td>;
              })}
              <td className={styles.weekTotal}>{formatHours(total(user.shifts))}</td>
            </tr>
          ))}</tbody>
        </table>
        {!visibleRows.length && <p className={styles.empty}>No shifts match this week and these filters. Use Add shift for a missed shift.</p>}
      </div>
      {selection && <FixDialog selection={selection} staff={staff} onClose={close} onSaved={() => { setSaved(true); close(); }} />}
    </>
  );
}

function FixDialog({ selection, staff, onClose, onSaved }: { selection: Selection; staff: Staff[]; onClose: () => void; onSaved: () => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const requestId = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const add = selection.kind === "add";
  const shift = selection.kind === "fix" ? selection.shift : null;
  const title = add ? "Add missed shift" : shift?.clockOut ? "Edit times" : "Set clock-out";
  useEffect(() => { dialog.current?.showModal(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const fields = new FormData(event.currentTarget);
    const reason = fields.get("reason");
    setError("");
    submitting.current = true;
    setPending(true);
    try {
      let endpoint: string;
      let body: object;
      if (selection.kind === "add") {
        if (!requestId.current) {
          if (!globalThis.crypto?.randomUUID) throw new Error("Open this admin site over HTTPS (or localhost) before adding a shift.");
          requestId.current = crypto.randomUUID();
        }
        endpoint = "add";
        body = { userId: fields.get("userId"), date: fields.get("date"), startTime: fields.get("startTime"), endTime: fields.get("endTime"), reason, requestId: requestId.current };
      } else if (selection.shift.clockOut) {
        endpoint = "edit";
        body = { shiftId: selection.shift.id, clockIn: fields.get("clockIn"), clockOut: fields.get("clockOut"), expectedUpdatedAt: selection.shift.updatedAt, reason };
      } else {
        endpoint = "clock-out";
        body = { shiftId: selection.shift.id, clockOut: fields.get("clockOut"), reason };
      }
      await requestJson(`/api/admin/timesheets/${endpoint}`, timesheetSuccessSchema, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      router.refresh();
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "The correction could not be saved. Please try again.");
    } finally { submitting.current = false; setPending(false); }
  }

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="fix-title"
      onCancel={event => { if (pending) event.preventDefault(); else onClose(); }}>
      <div className={styles.dialogHeader}><div><h2 id="fix-title">{title}</h2></div>
        <button type="button" onClick={onClose} disabled={pending}>Close</button></div>
      {selection.kind === "fix" && <p><strong>{selection.user.displayName}</strong><br />{describeTimes(selection.shift)}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <form onSubmit={submit} className={styles.fixForm} aria-busy={pending}>
        <fieldset disabled={pending}>
          {selection.kind === "add" ? <>
            <label>Staff member<select name="userId" required defaultValue={selection.userId}>
              <option value="">Choose staff member</option>{staff.map(user => <option key={user.id} value={user.id}>{user.displayName}</option>)}
            </select></label>
            <label>Date<input type="date" name="date" required defaultValue={selection.date} /></label>
            <label>Start time<input type="time" name="startTime" required /></label>
            <label>End time<input type="time" name="endTime" required /></label>
            <p>If end time is at or before start time, end is the next day. Maximum shift: 16 hours.</p>
          </> : <>
            {selection.shift.clockOut && <label>Clock-in<input type="datetime-local" name="clockIn" required defaultValue={toPerthLocal(new Date(selection.shift.clockIn))} /></label>}
            <label>Clock-out<input type="datetime-local" name="clockOut" required defaultValue={selection.shift.clockOut ? toPerthLocal(new Date(selection.shift.clockOut)) : ""} /></label>
          </>}
          <button type="submit">{pending ? "Saving..." : "Save correction"}</button>
        </fieldset>
      </form>
        {shift && <section className={styles.history}><h3>Edit history</h3>
        {!shift.audits.length ? <p>No corrections recorded.</p> : <ol>{shift.audits.map(audit => <li key={audit.id}>
          <strong>{actionLabels[audit.action] ?? audit.action}</strong> · {audit.actor}<br />
          <time dateTime={audit.createdAt}>{fullTime(audit.createdAt)}</time>
          <p>{describeTimes(audit.before)} → {describeTimes(audit.after)}</p><p>Reason: {audit.reason}</p>
        </li>)}</ol>}
      </section>}
    </dialog>
  );
}
