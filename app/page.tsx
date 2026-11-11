"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

const staffMembers = [
  { id: "nathanial", name: "Nathanial Tong", initials: "NT" },
  { id: "kelsey", name: "Kelsey Wang", initials: "KW" },
  { id: "gloria", name: "Gloria Yu", initials: "GY" },
];

const perthTime = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Perth",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const perthDate = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Perth",
  weekday: "long",
  day: "numeric",
  month: "long",
});

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export default function Home() {
  const [now, setNow] = useState<Date | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [activeShifts, setActiveShifts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const pinInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const updateTime = () => setNow(new Date());
    updateTime();
    const intervalId = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const selectedStaff = staffMembers.find((staff) => staff.id === selectedId);
  const clockInTime = selectedId ? activeShifts[selectedId] : undefined;

  function selectStaff(id: string | null) {
    setSelectedId(id);
    setPin("");
    setIsVerified(false);
    setNotice(null);
  }

  function handlePinChange(value: string) {
    setPin(value.replace(/\D/g, "").slice(0, 4));
  }

  function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedStaff && pin.length === 4) {
      setIsVerified(true);
      setPin("");
    }
  }

  function handleClockAction() {
    if (!selectedStaff || !isVerified) return;
    const timestamp = new Date();

    setActiveShifts((shifts) => {
      const updatedShifts = { ...shifts };
      if (clockInTime) {
        delete updatedShifts[selectedStaff.id];
      } else {
        updatedShifts[selectedStaff.id] = timestamp.toISOString();
      }
      return updatedShifts;
    });
    setNotice(
      `${selectedStaff.name} clocked ${clockInTime ? "out" : "in"} at ${perthTime.format(timestamp)}.`,
    );
    setSelectedId(null);
    setPin("");
    setIsVerified(false);
  }

  return (
    <main className="kiosk-shell">
      <h1 className="sr-only">Staff clock in and out</h1>
      <header className="topbar">
        <div className="brand" aria-label="SSS Parts team clock">
          <span className="brand-symbol" aria-hidden="true"><ClockIcon /></span>
          <span className="brand-name">SSS<span>Parts</span></span>
          <span className="brand-divider" />
          <span className="brand-product">Team clock</span>
        </div>
        <span className="kiosk-label"><span className="status-dot" />Shared iPad kiosk</span>
      </header>

      <div className="workspace">
        <aside className="welcome-panel" aria-label="Perth local time">
          <div className="time-card">
            <p className="time-label">LOCAL TIME <span>AWST</span></p>
            <p className="live-time">{now ? perthTime.format(now) : "--:--"}</p>
            <p className="date-line">{now ? perthDate.format(now) : "Loading local time"}</p>
          </div>
          <p className="clock-location">Perth, Western Australia</p>
        </aside>

        <section className="checkin-panel" aria-labelledby="checkin-title">
          <div className="checkin-topline">

            <span className="preview-badge">Design preview</span>
          </div>

          <ol className="stepper" aria-label="Clock-in steps">
            <li className={!selectedStaff ? "current" : "complete"} aria-current={!selectedStaff ? "step" : undefined}>
              <span>1</span>Your name
            </li>
            <li className={selectedStaff && !isVerified ? "current" : isVerified ? "complete" : ""} aria-current={selectedStaff && !isVerified ? "step" : undefined}>
              <span>2</span>Your PIN
            </li>
            <li className={isVerified ? "current" : ""} aria-current={isVerified ? "step" : undefined}>
              <span>3</span>Clock in / out
            </li>
          </ol>

          <div className="checkin-heading">
            <h2 id="checkin-title">{isVerified ? "You're all set." : selectedStaff ? `Hi, ${selectedStaff.name.split(" ")[0]}.` : "Who's clocking in?"}</h2>
            <p>{isVerified ? "One tap to update your shift." : selectedStaff ? "Enter your 4-digit PIN to continue." : "Find your name below. Let's get your day started."}</p>
          </div>

          {notice && <div className="success-notice" role="status"><span aria-hidden="true">&#10003;</span><div><strong>All done. Thank you!</strong><p>{notice}</p></div></div>}

          {!selectedStaff ? (
            <div className="staff-section">
              <div className="list-heading"><span>TEAM MEMBERS</span><span>{staffMembers.length.toString().padStart(2, "0")}</span></div>
              <div className="staff-list">
                {staffMembers.map((staff, index) => {
                  const isClockedIn = Boolean(activeShifts[staff.id]);
                  return (
                    <button className={`staff-card avatar-tone-${index}`} type="button" key={staff.id} onClick={() => selectStaff(staff.id)}>
                      <span className="staff-avatar">{staff.initials}</span>
                      <span className="staff-copy"><strong>{staff.name}</strong><span>Tap to continue</span></span>
                      <span className={`shift-badge${isClockedIn ? " on-shift" : ""}`}><span />{isClockedIn ? "On shift" : "Off shift"}</span>
                      <span className="staff-arrow"><Arrow /></span>
                    </button>
                  );
                })}
              </div>
              <p className="staff-help">Not on the list? Contact us for assistance.</p>
            </div>
          ) : (
            <div className="access-section">
              <div className="selected-person">
                <span className="staff-avatar">{selectedStaff.initials}</span>
                <span className="staff-copy"><strong>{selectedStaff.name}</strong><span>{clockInTime ? "Currently on shift" : "Currently off shift"}</span></span>
                <button className="text-button" type="button" onClick={() => selectStaff(null)}>Change</button>
              </div>

              {!isVerified ? (
                <form className="pin-form" onSubmit={handleVerify}>
                  <label className="sr-only" htmlFor="staff-pin">Your 4-digit PIN</label>
                  <div className="pin-entry" onClick={() => pinInput.current?.focus()}>
                    <input ref={pinInput} id="staff-pin" className="pin-input" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" value={pin} onChange={(event) => handlePinChange(event.target.value)} aria-describedby="pin-help" required />
                    <div className="pin-slots" aria-hidden="true">
                      {[0, 1, 2, 3].map((index) => <span className={pin.length > index ? "filled" : ""} key={index}>{pin.length > index ? "\u2022" : ""}</span>)}
                    </div>
                  </div>
                  <p id="pin-help" className="pin-help">Your PIN stays private on this shared device.</p>
                  <div className="keypad" aria-label="PIN keypad">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => <button key={digit} type="button" onClick={() => handlePinChange(pin + digit)} disabled={pin.length === 4}>{digit}</button>)}
                    <button className="keypad-text" type="button" onClick={() => setPin("")}>Clear</button>
                    <button type="button" onClick={() => handlePinChange(pin + "0")} disabled={pin.length === 4}>0</button>
                    <button className="keypad-delete" type="button" aria-label="Delete last digit" onClick={() => setPin(pin.slice(0, -1))}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5h11v14H9l-7-7 7-7Zm3 4 6 6m0-6-6 6" /></svg></button>
                  </div>
                  <button className="primary-button" type="submit" disabled={pin.length !== 4}>Continue<Arrow /></button>
                </form>
              ) : (
                <div className="shift-confirmation">
                  <span className="confirmation-icon"><ClockIcon /></span>
                  <h3>{clockInTime ? "Wrapping up for today?" : "Ready to start your shift?"}</h3>
                  <p>{clockInTime ? `You clocked in at ${perthTime.format(new Date(clockInTime))} AWST.` : "You're signed in. Your shift starts when you tap below."}</p>
                  <button className="primary-button" type="button" onClick={handleClockAction}>{clockInTime ? "Clock out" : "Clock in"}<Arrow /></button>
                  <button className="text-button cancel-button" type="button" onClick={() => selectStaff(null)}>Cancel and return to team</button>
                </div>
              )}
            </div>
          )}

          <div className="checkin-footer"><span className="privacy-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3 4 6v6c0 4 8 9 8 9s8-5 8-9V6l-8-3Z" /><path d="m8 12 3 3 5-6" /></svg></span><span>Your name. Your PIN. Your time.</span></div>
        </section>
      </div>

      <footer className="page-footer">
        <span>SSS Parts <span className="footer-separator">/</span> Made for the team.</span>
        <span>Preview only &middot; Any 4-digit PIN &middot; Shifts reset on refresh</span>
      </footer>
    </main>
  );
}
