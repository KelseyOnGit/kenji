# Team clock implementation plan

## 1. Registration and clock-in/out kiosk - current focus

- Keep the shared iPad workflow: search/select a name, enter a personal PIN, then
  explicitly clock in or out.
- Use a single name-or-phone autocomplete field with dropdown suggestions from
  the first character; narrow by prefix as staff keep typing.
- Use a plain local-time panel with a large clock, date, and Perth/AWST context.
  Remove slogans, decorative graphics, and redundant shift summaries.
- Keep the orange accents, clear staff list, touch keypad, confirmation, and
  return to the name picker after each clock action.
- Do not add a break function.
- Register with required full name and a self-chosen four-digit PIN; optional
  display name, phone, and email. No birthday is collected.
- Create staff as PENDING and store bcrypt PIN hashes at cost 10. Only ACTIVE
  staff are searchable and allowed to punch.
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
- Optional profile fields: contact number and email. Employment type and pay
  rate are set by an admin later, not through public registration.
- Admins can reset each staff member's PIN. Store PINs securely as hashes;
  provide resets rather than displaying existing PINs.
- Add approve/deactivate, employment type, effective-dated pay rates, and PIN reset.
- Confirm duplicate-name handling and profile editing permissions.

## 4. Admin timesheets - deferred

- Give admins control over timesheets: review records and correct clock times.
- Record who made corrections, when, and why.
- Confirm reporting periods, approval workflow, rounding rules, and handling of
  missed clock-ins/outs before implementation.
- No break feature or automatic break deductions are currently requested.

## 5. Admin payroll reports - deferred

- Give admins access to payroll reporting based on approved time records.
- Confirm report fields, export format, payroll integration, pay rules, and
  full-time/casual differences before implementation.
- Do not assume pay rates, overtime calculations, or a payroll-processing system.

Only phase 1 is being implemented now. Admin login, profiles, staff approval UI,
PIN reset UI, timesheets, and payroll reports remain planned work. Until admin
approval is built, a trusted operator must approve registrations in the database.
