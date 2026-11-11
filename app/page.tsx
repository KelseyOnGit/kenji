"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { punchResponseSchema, staffResponseSchema, type Staff } from "@/lib/contracts";
import { RequestError, requestJson } from "@/lib/client-api";

const perthTime = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Perth", hour: "2-digit", minute: "2-digit", hour12: false,
});
const perthDate = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Perth", weekday: "long", day: "numeric", month: "long",
});

function Arrow() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

function ClockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></svg>;
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default function Home() {
  const [now, setNow] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [search, setSearch] = useState({
    query: "", staff: [] as Staff[], hasMore: false, loading: false, error: "",
  });
  const [refresh, setRefresh] = useState(0);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [pin, setPin] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pinInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const requestId = useRef<string | null>(null);
  const normalizedQuery = query.trim();
  const clockInTime = selectedStaff?.currentShift?.clockIn;

  useEffect(() => {
    const updateTime = () => setNow(new Date());
    updateTime();
    const intervalId = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!normalizedQuery) return;
    const controller = new AbortController();
    async function load() {
      setSearch({ query: normalizedQuery, staff: [], hasMore: false, loading: true, error: "" });
      try {
        const result = await requestJson(`/api/staff?q=${encodeURIComponent(normalizedQuery)}`, staffResponseSchema, { signal: controller.signal });
        if (!controller.signal.aborted) setSearch({ query: normalizedQuery, ...result, loading: false, error: "" });
      } catch (error) {
        if (controller.signal.aborted) return;
        setSearch({
          query: normalizedQuery, staff: [], hasMore: false, loading: false,
          error: error instanceof Error ? error.message : "Staff search failed. Please try again.",
        });
      }
    }
    const timer = window.setTimeout(load, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedQuery, refresh]);

  useEffect(() => {
    if (!selectedStaff || pending) return;
    function reset() {
      setSelectedStaff(null);
      setQuery("");
      setPin("");
      setConfirming(false);
      setError("");
      requestId.current = null;
    }
    let timeout = window.setTimeout(reset, 60000);
    function activity() {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(reset, 60000);
    }
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
    };
  }, [selectedStaff, pending]);

  function selectStaff(staff: Staff | null) {
    setSelectedStaff(staff);
    setPin("");
    setConfirming(false);
    setError("");
    setNotice("");
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
    requestId.current = null;
  }

  function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedStaff && /^\d{4}$/.test(pin)) {
      setError("");
      setConfirming(true);
    }
  }

  async function handleClockAction() {
    if (!selectedStaff || !confirming || submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      if (typeof crypto.randomUUID !== "function") {
        throw new Error("Open this kiosk over HTTPS (or localhost) before clocking in or out.");
      }
      requestId.current ??= crypto.randomUUID();
      const result = await requestJson("/api/punch", punchResponseSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedStaff.id, pin,
          action: selectedStaff.currentShift ? "CLOCK_OUT" : "CLOCK_IN",
          expectedShiftId: selectedStaff.currentShift?.id ?? null,
          requestId: requestId.current,
        }),
      });
      setNotice(`${result.displayName} clocked ${result.action === "CLOCK_IN" ? "in" : "out"} at ${perthTime.format(new Date(result.occurredAt))} AWST.`);
      setSelectedStaff(null);
      setQuery("");
      requestId.current = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Clock action failed. Please try again.";
      setError(error instanceof RequestError && error.status === 0
        ? `${message} The result is unknown; retrying this same action will not duplicate it.`
        : message);
      if (error instanceof RequestError && [403, 409].includes(error.status)) {
        setSelectedStaff(null);
        setRefresh((value) => value + 1);
        requestId.current = null;
      }
    } finally {
      setPin("");
      setConfirming(false);
      setPending(false);
      submitting.current = false;
    }
  }

  const searching = normalizedQuery.length > 0 && (search.query !== normalizedQuery || search.loading);
  const results = !searching && normalizedQuery.length > 0 && search.query === normalizedQuery ? search.staff : [];
  const showSuggestions = suggestionsOpen && normalizedQuery.length > 0;

  return (
    <main className="kiosk-shell">
      <h1 className="sr-only">Staff clock in and out</h1>
      <header className="topbar">
        <div className="brand" aria-label="SSS Parts team clock">
          <span className="brand-symbol" aria-hidden="true"><ClockIcon /></span>
          <span className="brand-name">SSS<span>Parts</span></span>
          <span className="brand-divider" /><span className="brand-product">Team clock</span>
        </div>
        <Link className="nav-link" href="/register">New staff? Register</Link>
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
          <ol className="stepper" aria-label="Clock-in steps">
            <li className={!selectedStaff ? "current" : "complete"} aria-current={!selectedStaff ? "step" : undefined}><span>1</span>Your name</li>
            <li className={selectedStaff && !confirming ? "current" : confirming ? "complete" : ""} aria-current={selectedStaff && !confirming ? "step" : undefined}><span>2</span>Your PIN</li>
            <li className={confirming ? "current" : ""} aria-current={confirming ? "step" : undefined}><span>3</span>Clock in / out</li>
          </ol>
          <div className="checkin-heading">
            <h2 id="checkin-title">{confirming ? "Confirm your shift." : selectedStaff ? `Hi, ${selectedStaff.displayName.split(" ")[0]}.` : "Who's clocking in?"}</h2>
            <p>{confirming ? "Your PIN will be checked when you clock in or out." : selectedStaff ? "Enter the 4-digit PIN you chose when registering." : "Find yourself by name or phone number."}</p>
          </div>
          {error && <p className="error-notice" role="alert">{error}</p>}
          {notice && <div className="success-notice" role="status">{notice}</div>}

          {!selectedStaff ? (
            <div className="staff-section">
              <label className="input-label" htmlFor="staff-search">Name or phone number</label>
              <div className={`staff-autocomplete${showSuggestions ? " is-open" : ""}`}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setSuggestionsOpen(false);
                }}>
                <div className="search-input-wrap">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
                  <input className="text-input" id="staff-search" type="text" role="combobox"
                    aria-autocomplete="list" aria-expanded={showSuggestions}
                    aria-controls="staff-suggestions"
                    aria-activedescendant={showSuggestions && activeSuggestion >= 0 && activeSuggestion < results.length ? `staff-option-${activeSuggestion}` : undefined}
                    autoComplete="off" maxLength={120} placeholder="Search name or phone number"
                    value={query} onFocus={() => setSuggestionsOpen(true)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setSuggestionsOpen(false);
                        setActiveSuggestion(-1);
                      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        setSuggestionsOpen(true);
                        if (results.length) setActiveSuggestion((value) =>
                          event.key === "ArrowDown" ? (value + 1) % results.length : (value <= 0 ? results.length : value) - 1);
                      } else if (event.key === "Enter" && showSuggestions && results[activeSuggestion]) {
                        event.preventDefault();
                        selectStaff(results[activeSuggestion]);
                      }
                    }}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setSuggestionsOpen(true);
                      setActiveSuggestion(-1);
                      setError("");
                      setNotice("");
                    }} />
                </div>
                <ul className="staff-suggestions" id="staff-suggestions" role="listbox" aria-label="Staff suggestions" hidden={!showSuggestions}>
                  {results.map((staff, index) => (
                    <li id={`staff-option-${index}`} role="option" aria-selected={activeSuggestion === index}
                      className={`staff-suggestion${activeSuggestion === index ? " is-highlighted" : ""}`}
                      key={staff.id} onPointerDown={(event) => event.preventDefault()}
                      onPointerMove={() => setActiveSuggestion(index)}
                      onClick={() => selectStaff(staff)}>
                      <span className="staff-avatar">{initials(staff.displayName)}</span>
                      <span className="staff-copy"><strong>{staff.displayName}</strong></span>
                      <span className={`shift-badge${staff.currentShift ? " on-shift" : ""}`}><span />{staff.currentShift ? "On shift" : "Off shift"}</span>
                    </li>
                  ))}
                  {searching && <li className="suggestion-message" role="presentation">Searching...</li>}
                  {!searching && !search.error && results.length === 0 && <li className="suggestion-message" role="presentation">No approved staff found.</li>}
                  {!searching && search.error && <li className="suggestion-message" role="presentation">Search unavailable. Please retry below.</li>}
                </ul>
              </div>
              <div className="search-feedback" role="status">
                {!normalizedQuery ? "Start typing to see staff suggestions." : searching ? "Searching..." : search.error ? "" : `${results.length}${search.hasMore ? "+" : ""} matching staff`}
              </div>
              {!searching && normalizedQuery.length > 0 && search.error && (
                <div className="error-notice" role="alert">{search.error}<button className="text-button" type="button" onClick={() => setRefresh((value) => value + 1)}>Retry search</button></div>
              )}
              {!searching && search.hasMore && results.length > 0 && <p className="staff-help">Keep typing to narrow the suggestions.</p>}

            </div>
          ) : (
            <div className="access-section">
              <div className="selected-person">
                <span className="staff-avatar">{initials(selectedStaff.displayName)}</span>
                <span className="staff-copy"><strong>{selectedStaff.displayName}</strong><span>{clockInTime ? "Currently on shift" : "Currently off shift"}</span></span>
                <button className="text-button" type="button" disabled={pending} onClick={() => selectStaff(null)}>Change</button>
              </div>
              {!confirming ? (
                <form className="pin-form" onSubmit={handleVerify}>
                  <label className="sr-only" htmlFor="staff-pin">Your 4-digit PIN</label>
                  <div className="pin-entry" onClick={() => pinInput.current?.focus()}>
                    <input ref={pinInput} id="staff-pin" className="pin-input" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} aria-describedby="pin-help" required />
                    <div className="pin-slots" aria-hidden="true">{[0, 1, 2, 3].map((index) => <span className={pin.length > index ? "filled" : ""} key={index}>{pin.length > index ? "\u2022" : ""}</span>)}</div>
                  </div>
                  <p id="pin-help" className="pin-help">Forgotten your PIN? Contact your manager.</p>
                  <div className="keypad" aria-label="PIN keypad">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => <button key={digit} type="button" onClick={() => setPin((value) => (value + digit).slice(0, 4))} disabled={pin.length === 4}>{digit}</button>)}
                    <button className="keypad-text" type="button" onClick={() => setPin("")}>Clear</button>
                    <button type="button" onClick={() => setPin((value) => (value + "0").slice(0, 4))} disabled={pin.length === 4}>0</button>
                    <button className="keypad-text" type="button" aria-label="Delete last digit" onClick={() => setPin((value) => value.slice(0, -1))}>Delete</button>
                  </div>
                  <button className="primary-button" type="submit" disabled={pin.length !== 4}>Continue<Arrow /></button>
                </form>
              ) : (
                <div className="shift-confirmation" aria-busy={pending}>
                  <span className="confirmation-icon"><ClockIcon /></span>
                  <h3>{clockInTime ? "Wrapping up for today?" : "Ready to start your shift?"}</h3>
                  <p>{clockInTime ? `You clocked in at ${perthTime.format(new Date(clockInTime))} AWST.` : "Your shift starts when you tap below and your PIN is verified."}</p>
                  <button className="primary-button" type="button" disabled={pending} onClick={handleClockAction}>{pending ? "Saving..." : clockInTime ? "Clock out" : "Clock in"}<Arrow /></button>
                  <button className="text-button cancel-button" type="button" disabled={pending} onClick={() => selectStaff(null)}>Cancel and return to search</button>
                </div>
              )}
            </div>
          )}
          <div className="checkin-footer">Your name. Your PIN. Your time.</div>
        </section>
      </div>
      <footer className="page-footer"><span>SSS Parts / Team clock</span><span>Shared iPad kiosk &middot; All times AWST</span></footer>
    </main>
  );
}
