"use client";

import { createContext, use, useMemo, useRef, type ReactNode } from "react";

type Opener = () => void;
type LeaveActions = {
  /** Called by LeaveRequests to say "this is how to open the new-request form". Returns an unregister function. */
  registerNewRequest: (open: Opener) => () => void;
  registerRequests: (open: Opener) => () => void;
  /** Called by the header's "Request leave" button. */
  requestNew: () => void;
  showRequests: () => void;
};

const LeaveActionsContext = createContext<LeaveActions | null>(null);

/** Lets the page header open the "Request leave" dialog that lives inside LeaveRequests. */
export function LeaveActionsProvider({ children }: { children: ReactNode }) {
  const opener = useRef<Opener | null>(null);
  const requestsOpener = useRef<Opener | null>(null);
  const value = useMemo<LeaveActions>(() => ({
    registerNewRequest(open) {
      opener.current = open;
      return () => { if (opener.current === open) opener.current = null; };
    },
    requestNew() { opener.current?.(); },
    registerRequests(open) {
      requestsOpener.current = open;
      return () => { if (requestsOpener.current === open) requestsOpener.current = null; };
    },
    showRequests() { requestsOpener.current?.(); },
  }), []);
  return <LeaveActionsContext value={value}>{children}</LeaveActionsContext>;
}

/** Returns null outside the provider (the admin page has no provider). */
export function useLeaveActions() {
  return use(LeaveActionsContext);
}