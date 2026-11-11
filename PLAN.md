# Team clock implementation plan

## 1. Clock-in/out kiosk - current focus

- Keep the shared iPad workflow: select a name, enter a personal PIN, then
  explicitly clock in or out.
- Use a plain local-time panel with a large clock, date, and Perth/AWST context.
  Remove slogans, decorative graphics, and redundant shift summaries.
- Keep the orange accents, clear staff list, touch keypad, confirmation, and
  return to the name picker after each clock action.
- Do not add a break function.
- Keep the prototype clearly labeled: any four-digit PIN works and shifts reset
  on refresh.
- Before real use, connect staff and shifts to Neon, verify PINs on the server,
  rate-limit failed attempts, use server timestamps, and prevent duplicate or
  conflicting clock actions. Never expose stored PINs to the kiosk.
- Verify the flow on iPad in portrait and landscape, including missed/duplicate
  actions, connectivity errors, and safe handling of inactive staff.

## 2. Staff signup and profiles - deferred

- Add a staff signup page and profile management.
- Required fields: full name and PIN. No staff-facing ID is required.
- Optional fields: contact number, email, and employment status (full time or
  casual). Employment status is optional because only name and PIN are required.
- Admins can reset each staff member's PIN. Store PINs securely as hashes;
  provide resets rather than displaying existing PINs.
- Decide signup access, admin approval, duplicate-name handling, and profile
  editing permissions before implementing this phase.
- Introduce separately protected admin access; staff PIN access must not grant
  administrative permissions.

## 3. Admin timesheets - deferred

- Give admins control over timesheets: review records and correct clock times.
- Record who made corrections, when, and why.
- Confirm reporting periods, approval workflow, rounding rules, and handling of
  missed clock-ins/outs before implementation.
- No break feature or automatic break deductions are currently requested.

## 4. Admin payroll reports - deferred

- Give admins access to payroll reporting based on approved time records.
- Confirm report fields, export format, payroll integration, pay rules, and
  full-time/casual differences before implementation.
- Do not assume pay rates, overtime calculations, or a payroll-processing system.

Only phase 1 is being implemented now. Signup, profiles, admin management,
timesheets, and payroll reports remain planned work.
