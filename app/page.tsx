"use client";

import { useEffect, useState, type FormEvent } from "react";

type StaffMember = {
  id: string;
  name: string;
  initials: string;
};

const staffMembers: StaffMember[] = [
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
  year: "numeric",
});

function formatTime(date: Date) {
  return perthTime.format(date);
}

export default function Home() {
  const [now, setNow] = useState<Date | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [activeShifts, setActiveShifts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const updateTime = () => setNow(new Date());
    updateTime();
    const intervalId = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const selectedStaff = staffMembers.find(
    (staffMember) => staffMember.id === selectedId,
  );
  const clockInTime = selectedId ? activeShifts[selectedId] : undefined;

  function selectStaff(id: string | null) {
    setSelectedId(id);
    setPin("");
    setIsVerified(false);
    setNotice(null);
  }

  function handlePinChange(value: string) {
    setPin(value.replace(/\D/g, "").slice(0, 4));
    setIsVerified(false);
    setNotice(null);
  }

  function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pin.length === 4) {
      setIsVerified(true);
      setNotice(null);
    }
  }

  function handleClockAction() {
    if (!selectedStaff || !isVerified) return;

    if (clockInTime) {
      setActiveShifts((shifts) => {
        const updatedShifts = { ...shifts };
        delete updatedShifts[selectedStaff.id];
        return updatedShifts;
      });
      setNotice(`${selectedStaff.name} clocked out at ${formatTime(new Date())}.`);
    } else {
      setActiveShifts((shifts) => ({
        ...shifts,
        [selectedStaff.id]: new Date().toISOString(),
      }));
      setNotice(`${selectedStaff.name} clocked in at ${formatTime(new Date())}.`);
    }

    setPin("");
    setIsVerified(false);
  }

  return (
    <main className="kiosk-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            SSS
          </span>
          <span className="brand-copy">
            <strong>SSS PARTS</strong>
            <span>TEAM CLOCK</span>
          </span>
        </div>

        <div className="topbar-meta">
          <span className="kiosk-pill">
            <span className="status-dot" />
            KIOSK MODE
          </span>
          <span className="topbar-divider" />
          <span className="location-label">PERTH, WA</span>
        </div>
      </header>

      <div className="page-content">
        <section className="intro" aria-labelledby="page-title">
          <div className="intro-copy">
            <p className="eyebrow">
              <span className="eyebrow-line" />
              STAFF TIME CLOCK
            </p>
            <h1 id="page-title">
              Clock in when
              <br />
              <span>you are Ready.</span>
            </h1>
          </div>
          <div className="intro-aside">
            <span className="live-time">{now ? formatTime(now) : "--:--"}</span>
            <span className="date-line">
              {now ? perthDate.format(now) : "Loading local time"}
            </span>
            <span className="timezone-label">AUSTRALIAN WESTERN STANDARD TIME</span>
          </div>
        </section>

        <section className="clock-panel" aria-label="Staff clock in and out">
          <div className="panel-heading">
            <div>
              <span className="section-index">01 / STAFF</span>
              <h2>Select your name</h2>
              <p>Then enter your personal PIN to continue.</p>
            </div>
            <span className="preview-tag">DESIGN PREVIEW · SAMPLE STAFF</span>
          </div>

          <div className="clock-layout">
            <div className="staff-section">
              <div className="field-heading">
                <span>YOUR NAME</span>
                <span className="staff-count">04 STAFF</span>
              </div>
              <div className="staff-grid">
                {staffMembers.map((staffMember) => {
                  const isSelected = staffMember.id === selectedId;
                  const isClockedIn = Boolean(activeShifts[staffMember.id]);

                  return (
                    <button
                      className={`staff-card${isSelected ? " is-selected" : ""}`}
                      type="button"
                      key={staffMember.id}
                      aria-pressed={isSelected}
                      onClick={() => selectStaff(staffMember.id)}
                    >
                      <span className="staff-avatar">{staffMember.initials}</span>
                      <span className="staff-card-copy">
                        <strong>{staffMember.name}</strong>
                        <span className="staff-state">
                          <span
                            className={`small-dot${isClockedIn ? " is-active" : ""}`}
                          />
                          {isClockedIn ? "ON SHIFT" : "OFF SHIFT"}
                        </span>
                      </span>
                      <span className="selection-indicator" aria-hidden="true">
                        {isSelected ? "✓" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>

            </div>

            <div className="pin-section">
              <div className="field-heading">
                <span>02 / PIN ACCESS</span>
                <span className="lock-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" fill="none">
                    <rect
                      x="3.25"
                      y="7"
                      width="9.5"
                      height="7"
                      rx="1.5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <path
                      d="M5.5 7V4.75a2.5 2.5 0 0 1 5 0V7"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </div>

              {selectedStaff ? (
                <div className="selected-person">
                  <span className="selected-avatar">{selectedStaff.initials}</span>
                  <span>
                    <span className="selected-label">CLOCKING IN AS</span>
                    <strong>{selectedStaff.name}</strong>
                  </span>
                  <button
                    className="change-staff"
                    type="button"
                    onClick={() => selectStaff(null)}
                  >
                    CHANGE
                  </button>
                </div>
              ) : (
                <div className="pin-empty">
                  <span className="pin-empty-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="8" r="3.25" />
                      <path d="M5.5 20v-1.6a6.5 6.5 0 0 1 13 0V20z" />
                    </svg>
                  </span>
                  <strong>Select your name first</strong>
                  <span>Your PIN entry will appear here.</span>
                </div>
              )}

              {selectedStaff && (
                <form className="pin-form" onSubmit={handleVerify}>
                  <label htmlFor="staff-pin">YOUR 4-DIGIT PIN</label>
                  <input
                    id="staff-pin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    autoComplete="off"
                    placeholder="••••"
                    value={pin}
                    onChange={(event) => handlePinChange(event.target.value)}
                    aria-describedby="pin-help"
                    required
                  />
                  <span id="pin-help" className="pin-help">
                    Enter the PIN you use for the staff time clock.
                  </span>
                  <button
                    className="verify-button"
                    type="submit"
                    disabled={pin.length !== 4}
                  >
                    VERIFY PIN
                    <span aria-hidden="true">→</span>
                  </button>
                </form>
              )}

              {selectedStaff && isVerified && (
                <div className="action-panel" aria-live="polite">
                  {clockInTime ? (
                    <>
                      <span className="shift-status active">
                        <span className="small-dot is-active" />
                        CURRENTLY ON SHIFT
                      </span>
                      <p>
                        Clocked in at{" "}
                        <strong>{formatTime(new Date(clockInTime))}</strong>
                      </p>
                    </>
                  ) : (
                    <span className="shift-status">
                      READY TO START YOUR SHIFT
                    </span>
                  )}
                  <button
                    className={`clock-action${clockInTime ? " clock-out" : ""}`}
                    type="button"
                    onClick={handleClockAction}
                  >
                    {clockInTime ? "CLOCK OUT" : "CLOCK IN"}
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              )}

              {notice && (
                <p className="action-notice" role="status">
                  <span aria-hidden="true">✓</span>
                  {notice}
                </p>
              )}
            </div>
          </div>
        </section>

        <footer className="page-footer">
          <span>SSS PARTS · TEAM TIME CLOCK</span>
          <span>
            <span className="footer-dot" />
            CLOCK IN / CLOCK OUT
          </span>
          <span>ALL TIMES AWST</span>
        </footer>

        <p className="preview-disclaimer">
          Preview only: sample staff, any four-digit PIN accepted.
        </p>
      </div>
    </main>
  );
}
