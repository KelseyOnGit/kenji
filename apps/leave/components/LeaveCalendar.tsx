import Link from "next/link";
import { displayLeaveDate, leaveDates, monthWindow, type CalendarLeave } from "@leave/lib/leave";
import { DAY_MS, perthLocalToDate } from "@leave/lib/timesheets";
import { waPublicHoliday } from "@leave/lib/public-holidays";
import styles from "./leave.module.css";

export default function LeaveCalendar({ month, leaves, basePath }: {
  month: string; leaves: CalendarLeave[]; basePath: string;
}) {
  const window = monthWindow(month);
  return (
    <section className={styles.panel} aria-labelledby="team-calendar">
      <header className={styles.sectionHeader}>
        <div><h2 id="team-calendar">Team leave calendar</h2></div>
        <nav className={styles.navigation} aria-label="Leave calendar month">
          <Link href={`${basePath}?month=${window.previous}`} aria-label="Previous month">Previous</Link>
          <Link href={basePath}>This month</Link>
          <Link href={`${basePath}?month=${window.next}`} aria-label="Next month">Next</Link>
        </nav>
      </header>
      <h3 className={styles.month}>{window.label}</h3>
      <div className={styles.calendarScroll}>
        <div className={styles.calendar} role="table" aria-label={`${window.label} approved leave`}>
          <div className={styles.week} role="row">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => <div key={day} role="columnheader" className={styles.weekday}>{day}</div>)}
          </div>
          {Array.from({ length: Math.ceil((window.offset + window.days) / 7) }, (_, week) => (
            <div className={styles.week} role="row" key={week}>
              {Array.from({ length: 7 }, (_, weekday) => {
                const day = week * 7 + weekday - window.offset + 1;
                if (day < 1 || day > window.days) return <div key={weekday} role="cell" className={styles.blank} />;
                const date = `${month}-${String(day).padStart(2, "0")}`;
                const start = perthLocalToDate(`${date}T00:00`).getTime();
                const holiday = waPublicHoliday(date);
                const entries = leaves.filter(leave => new Date(leave.startsAt).getTime() < start + DAY_MS && new Date(leave.endsAt).getTime() > start);
                return (
                  <div key={weekday} role="cell" className={`${styles.day} ${weekday > 4 ? styles.weekend : ""} ${holiday ? styles.holiday : ""}`} aria-label={`${displayLeaveDate(date)}${holiday ? `, ${holiday.name}` : ""}`}>
                    <time dateTime={date}>{day}</time>
                    {holiday && <div className={styles.holidayLabel}>{holiday.name}</div>}
                    {entries.map(leave => {
                      const times = leaveDates(leave);
                      return <div className={styles.absence} key={leave.id}>{leave.name}{!leave.allDay && <small>{times.startTime} - {times.endTime}</small>}</div>;
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <details className={styles.schedule} open>
        <summary>Leave list - {window.label}</summary>
        {leaves.length === 0 ? <p>No approved leave this month.</p> : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead><tr><th scope="col">Name</th><th scope="col">From</th><th scope="col">To</th><th scope="col">Back to Work</th></tr></thead>
              <tbody>{leaves.map(leave => {
                const dates = leaveDates(leave);
                return <tr key={leave.id}><th scope="row">{leave.name}</th>
                  <td>{displayLeaveDate(dates.startDate)}{dates.startTime && `, ${dates.startTime}`}</td>
                  <td>{displayLeaveDate(dates.endDate)}{dates.endTime && `, ${dates.endTime}`}</td>
                  <td>{displayLeaveDate(leave.returnDate)}{leave.returnTime && `, ${leave.returnTime}`}</td></tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </details>
    </section>
  );
}
