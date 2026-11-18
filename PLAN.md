# Team clock implementation plan

## 1. Registration and clock-in/out kiosk - current focus

- Keep the shared iPad workflow: search/select a name, enter a personal PIN, then
  explicitly clock in or out.
- Use a single name-or-phone autocomplete field with dropdown suggestions from
  the first character; narrow by prefix as staff keep typing.
- Use a plain local-time panel with a large clock, date, and Perth/AWST context.
  Remove slogans, decorative graphics, and redundant shift summaries.
- Keep the orange accents, clear staff list, and touch keypad. Submit the clock
  action directly from the PIN screen, then return to search with a success message.
- Do not add a break function.
- Register with required full name and a self-chosen four-digit PIN; optional
  display name, phone, and email. No birthday is collected.
- Store bcrypt PIN hashes at cost 10. New staff are PENDING by default; a
  temporary `AUTO_APPROVE_STAFF=true` testing switch creates ACTIVE staff.
  Only ACTIVE staff are searchable and allowed to punch.
- Use PostgreSQL persistence, database timestamps, row-locked transactions,
  explicit actions, expected shift IDs, and idempotent request UUIDs.
- No lockout or attempt throttling, per the confirmed choice. Repeated PIN
  guessing is a known rollout risk.
- Apply the committed initial migration to a new Neon database and verify the
  deployment connection. Existing databases require a baseline/data migration.
- Verify the flow on iPad in portrait and landscape, including missed/duplicate
  actions, connectivity errors, and safe handling of inactive staff.

## 2. Admin login and protected access - deferred

- Add admin login and `proxy.ts` for admin navigation, plus server-side
  authorization on every admin data operation.
- Staff PIN access must not grant administrative permissions.

## 3. Staff list and profiles - deferred

- Add admin staff list and profile management, with pending approvals first.
- Required fields: full name and PIN. No staff-facing ID is required.
- Optional profile fields: contact number and email. Employment type is set
  by an admin later, not through public registration.
- Admins can reset each staff member's PIN. Store PINs securely as hashes;
  provide resets rather than displaying existing PINs.
- Add approve/deactivate, employment type, and PIN reset.
- Confirm duplicate-name handling and profile editing permissions.

## 4. Admin timesheets - implemented in the existing admin portal

- `/admin/timesheets` displays Monday-to-Friday within each Perth week, grouped
  by clock-in date. Weekend records stay saved but are excluded from this view
  and its totals, with a notice when present.
- Use a light, high-contrast table and plain-text shifts with a visible separator
  before their hours. Show hours/minutes only, no decimal duplicates. Daily totals
  appear at the bottom of cells with multiple shifts. Add shift replaces empty-cell buttons.
- Search filters immediately as you type; a compact Problems only toggle filters
  missing clock-outs without an Apply button. Week navigation has visible separators.
- Lives in `apps/leave` under the existing admin sign-in and sidebar, reading
  the shared timer shift records. Staff have no timesheet page or correction access;
  their portal remains for leave requests. The timer kiosk is unchanged.
- Navigate weeks, search staff, and filter missing clock-outs. Inactive staff
  who worked are included; Add shift also supports staff without shifts that week.
- Unfinished shifts show Clocked in or Missing clock-out, without hours.
  Missing clock-outs have lasted at least 16 hours;
  a dashboard link opens the oldest affected week with the problems filter on.
- Admins can set a missing clock-out, edit completed times, or add a missed
  completed shift. Every correction needs a 3–500 character reason and records
  the actor, database timestamp, and before/after times in `ShiftAudit`.
- Local date/time inputs use AWST (UTC+08:00). An add-shift end time at or
  before start means the next day. Completed shifts must be positive, no longer
  than 16 hours, not in the future, and non-overlapping.
- Every write locks the staff row, re-reads current data, validates using the
  database clock, and commits the change with its audit atomically. Stale edits
  and kiosk clock-outs return 409; add-shift request UUIDs prevent duplicates.
- Fix dialogs show newest-first edit history. Pages and APIs independently
  require admin authorization. Only necessary fields reach the browser.
- No shift deletion, breaks, deductions, rosters, pay calculations, payroll,
  payslips, pay-rate management, or exports are planned.
- Apply the additive `shift_audit` migration once through the controlled migration
  process before using these pages. It is not applied by app builds.
- Adding shifts requires HTTPS (or localhost) for `crypto.randomUUID()`.

Admin login and a dashboard are in progress. Profiles, staff approval UI, PIN
reset UI remain planned work. Disable temporary
auto-approval before rollout once the approval workflow is available.
