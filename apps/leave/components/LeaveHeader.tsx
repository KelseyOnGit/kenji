"use client";

import { useLeaveActions } from "./LeaveActions";
import styles from "./leave.module.css";

export default function LeaveHeader({ pendingCount, admin = false }: { pendingCount: number; admin?: boolean }) {
  const actions = useLeaveActions();

  return (
    <header className={styles.hero}>
      <div>
        <p className={styles.eyebrow}>{admin ? "Admin / Leave" : "Staff portal"}</p>
        <h1>{admin ? "Leave requests" : "Leave calendar & requests"}</h1>
        <p className={styles.subtitle}>{admin ? "Review and manage leave requests from all staff." : "See who's away, track your requests, or ask for time off."}</p>
      </div>
      <div className={styles.heroActions}>
        <button type="button" onClick={() => actions?.showRequests()} className={`${styles.headerButton} ${styles.secondaryButton}`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" />
          </svg>
          
          {admin ? "Review leave requests" : "My leave requests"}
          {pendingCount > 0 && <>
            <span className={styles.badge} aria-hidden="true">{pendingCount}</span>
            <span className={styles.srOnly}>, {pendingCount} pending</span>
          </>}
        </button>
        {!admin && (
          <button type="button" onClick={() => actions?.requestNew()} className={`${styles.headerButton} ${styles.primaryButton}`}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Request leave
          </button>
        )}
      </div>
    </header>
  );
}